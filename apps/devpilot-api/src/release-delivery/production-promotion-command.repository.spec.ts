import { PrismaService } from "../prisma/prisma.service";
import { promotionCommandInputHash } from "./production-promotion-command.policy";
import { ProductionPromotionCommandRepository } from "./production-promotion-command.repository";
import { ProductionPromotionLeaseLostError } from "./production-promotion-lease.policy";
import { freezeProductionPromotionCandidate } from "./production-promotion-candidate.policy";

describe("ProductionPromotionCommandRepository lease CAS", () => {
  it("does not execute an exact replay while its lease is active", async () => {
    const fixture = setup(new Date("2099-08-11T00:00:00.000Z"));
    const result = await fixture.repository.reserve(fixture.input);
    expect(result.shouldExecute).toBe(false);
    expect(fixture.tx.productionPromotionCommand.update).not.toHaveBeenCalled();
  });

  it("reclaims only an expired exact command and rotates its lease", async () => {
    const fixture = setup(new Date("2020-01-01T00:00:00.000Z"));
    const result = await fixture.repository.reserve(fixture.input);
    expect(result.shouldExecute).toBe(true);
    expect(result.recovered).toBe(true);
    expect(result.lease?.token).toMatch(/^[a-f0-9]{64}$/);
    expect(fixture.tx.productionPromotionCommand.update).toHaveBeenCalledWith({
      where: { id: "command-1" },
      data: expect.objectContaining({
        leaseOwner: expect.stringContaining("promotion-"),
        leaseTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        attemptCount: { increment: 1 },
      }),
    });
  });

  it("fails closed when heartbeat no longer owns the lease token", async () => {
    const prisma = {
      productionPromotionCommand: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;
    const repository = new ProductionPromotionCommandRepository(prisma);
    await expect(repository.heartbeat("command-1", {
      owner: "owner-1", token: "token-1", tokenHash: "hash",
      expiresAt: new Date("2099-08-11T00:00:00.000Z"),
    })).rejects.toBeInstanceOf(ProductionPromotionLeaseLostError);
  });
});

function setup(leaseExpiresAt: Date) {
  const scope = {
    teamId: "team-1", projectId: "project-1",
    environmentId: "environment-1", releaseRunId: "release-1",
    deploymentRunId: "deployment-1",
  };
  const candidate = freezeProductionPromotionCandidate({
    ...scope, version: 1, releaseOrderId: "order-1",
    configRevisionId: "config-1", manifestId: "manifest-1",
    manifestDigest: `sha256:${"a".repeat(64)}`, buildRunId: "build-1",
    providerKey: "ssh-v1", bindingId: "binding-1",
    deploymentInputHash: "b".repeat(64), workloadInputHash: "c".repeat(64),
    workloadServiceCount: 1, workloadHealthConfigured: true,
    targetRef: "server-1", kind: "upgrade",
  });
  const input = { ...scope, actorId: "actor-2", idempotencyKey: "resume-0001",
    candidateHash: candidate.candidateHash };
  const existing = {
    id: "command-1", ...input, releaseOrderId: "order-1",
    inputHash: promotionCommandInputHash(input), status: "running",
    phase: "reserved", leaseOwner: "old-owner", leaseTokenHash: "old-hash",
    leaseExpiresAt, heartbeatAt: leaseExpiresAt, attemptCount: 1,
    preDecisionId: null, preDecisionInputHash: null, preDecisionActionHash: null,
    postDecisionId: null, postDecisionInputHash: null, postDecisionActionHash: null,
    routeSwitchOperationId: null, observationRecordedAt: null,
    result: null, errorCode: null, errorMessage: null,
  };
  const deployment = {
    result: { productionCandidate: candidate }, logs: [],
    artifactManifestId: "manifest-1", adapterKey: "ssh-v1",
    projectEnvironment: { status: "active", baselineRole: "production",
      currentConfigRevisionId: "config-1" },
    artifactManifest: { id: "manifest-1", digest: candidate.manifestDigest,
      buildRunId: "build-1", releaseOrderId: "order-1" },
    releaseRun: { id: "release-1", status: "awaiting_validation",
      artifactManifestId: "manifest-1", verifiedDigest: candidate.manifestDigest,
      configRevisionId: "config-1", inputHash: "release-hash", routeSnapshot: {},
      operationApprovalId: "approval-1" },
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "locked" }]),
    deploymentRun: { findFirst: jest.fn().mockResolvedValue(deployment) },
    operationApproval: { findFirst: jest.fn().mockResolvedValue({ expiresAt: null }) },
    productionPromotionCommand: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn(({ data }) => Promise.resolve({ ...existing, ...data })),
      findFirst: jest.fn(), create: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
  } as unknown as PrismaService;
  return {
    input, tx,
    repository: new ProductionPromotionCommandRepository(prisma),
  };
}
