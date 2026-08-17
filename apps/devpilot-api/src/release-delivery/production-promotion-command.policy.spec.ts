import { ConflictException } from "@nestjs/common";
import { freezeProductionPromotionCandidate } from "./production-promotion-candidate.policy";
import {
  assertPromotionCommandReplay,
  exactFrozenCandidate,
  promotionCommandInputHash,
} from "./production-promotion-command.policy";

describe("Production promotion command policy", () => {
  const input = {
    teamId: "team-1", projectId: "project-1", actorId: "actor-2",
    environmentId: "environment-1", releaseRunId: "release-1",
    deploymentRunId: "deployment-1", candidateHash: "", idempotencyKey: "resume-0001",
  };
  const candidate = freezeProductionPromotionCandidate({
    version: 1, teamId: input.teamId, projectId: input.projectId,
    releaseOrderId: "order-1", environmentId: input.environmentId,
    releaseRunId: input.releaseRunId, deploymentRunId: input.deploymentRunId,
    configRevisionId: "config-1", manifestId: "manifest-1",
    manifestDigest: `sha256:${"a".repeat(64)}`, buildRunId: "build-1",
    providerKey: "ssh-v1", bindingId: "binding-1",
    deploymentInputHash: "b".repeat(64), workloadInputHash: "c".repeat(64),
    workloadServiceCount: 1, workloadHealthConfigured: true, targetRef: "server-1",
    kind: "upgrade",
  });

  it("accepts only the exact frozen candidate", () => {
    const exact = { ...input, candidateHash: candidate.candidateHash };
    expect(exactFrozenCandidate({ productionCandidate: candidate }, exact))
      .toEqual(candidate);
    expect(() => exactFrozenCandidate(
      { productionCandidate: candidate },
      { ...exact, candidateHash: "d".repeat(64) },
    )).toThrow(ConflictException);
  });

  it("separates command idempotency from candidate and actor drift", () => {
    const exact = { ...input, candidateHash: candidate.candidateHash };
    const inputHash = promotionCommandInputHash(exact);
    assertPromotionCommandReplay({ inputHash } as never, inputHash);
    expect(() => assertPromotionCommandReplay(
      { inputHash } as never,
      promotionCommandInputHash({ ...exact, actorId: "actor-3" }),
    )).toThrow(ConflictException);
  });
});
