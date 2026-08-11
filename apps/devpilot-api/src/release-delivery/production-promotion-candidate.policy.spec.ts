import {
  freezeProductionPromotionCandidate,
  parseFrozenProductionCandidate,
  type ProductionPromotionCandidate,
} from "./production-promotion-candidate.policy";

describe("Production promotion candidate", () => {
  it("binds every frozen release and deployment identity", () => {
    const frozen = freezeProductionPromotionCandidate(candidate());
    expect(parseFrozenProductionCandidate(frozen)).toEqual(frozen);
    expect(frozen.candidateHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed when a frozen fact drifts", () => {
    const frozen = freezeProductionPromotionCandidate(candidate());
    expect(parseFrozenProductionCandidate({ ...frozen, targetRef: "other" }))
      .toBeNull();
  });
});

function candidate(): ProductionPromotionCandidate {
  return {
    version: 1,
    teamId: "team-1",
    projectId: "project-1",
    releaseOrderId: "order-1",
    environmentId: "production-1",
    releaseRunId: "release-1",
    deploymentRunId: "deployment-1",
    configRevisionId: "config-1",
    manifestId: "manifest-1",
    manifestDigest: `sha256:${"a".repeat(64)}`,
    buildRunId: "build-1",
    providerKey: "ssh-v1",
    bindingId: "binding-1",
    deploymentInputHash: "b".repeat(64),
    workloadInputHash: "c".repeat(64),
    workloadServiceCount: 1,
    workloadHealthConfigured: true,
    targetRef: "server-1",
    kind: "upgrade",
  };
}
