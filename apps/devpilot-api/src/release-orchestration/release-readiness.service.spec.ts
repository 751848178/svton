import { ReleaseReadinessService } from "./release-readiness.service";
import type { ReadinessStageView } from "./release-readiness.service";
import { expectedStageInputHash } from "./utils/release-approval-predicate.utils";

const stageRepo = { findById: jest.fn(), findActiveByConcurrencyKey: jest.fn() };

function buildService() {
  jest.clearAllMocks();
  stageRepo.findById.mockResolvedValue(null);
  stageRepo.findActiveByConcurrencyKey.mockResolvedValue(null);
  return new ReleaseReadinessService(stageRepo as any);
}

const baseStage = (over: Partial<ReadinessStageView>): ReadinessStageView => ({
  id: "stage-1",
  releasePlanId: "plan-1",
  teamId: "team-1",
  key: "schema_migration:svc",
  name: "迁移",
  type: "schema_migration",
  status: "pending",
  required: true,
  currentAttempt: 0,
  executorKind: "server_command",
  riskLevel: "medium",
  applicationId: null,
  applicationServiceId: null,
  environmentId: "env-1",
  serverId: null,
  configSnapshot: {},
  configHash: "hash-v1",
  concurrencyKey: null,
  stageApproval: null,
  releasePlan: { id: "plan-1", projectId: "proj-1", environmentId: "env-1", teamId: "team-1" },
  dependencies: [],
  attempts: [],
  ...over,
});

const expectedHash = (stage: ReadinessStageView) =>
  expectedStageInputHash({
    releasePlanId: stage.releasePlanId,
    key: stage.key,
    environmentId: stage.releasePlan.environmentId,
    configHash: stage.configHash,
  });

describe("ReleaseReadinessService.isApprovalSatisfied (via assembleFacts)", () => {
  it("low-risk non-manual_gate → approvalSatisfied true", async () => {
    const svc = buildService();
    const facts = await svc.assembleFacts(
      baseStage({ riskLevel: "low", executorKind: "server_command" }),
    );
    expect(facts.approvalSatisfied).toBe(true);
  });

  it("medium-risk with approved matching approval → approvalSatisfied true", async () => {
    const svc = buildService();
    const stage = baseStage({});
    const facts = await svc.assembleFacts(
      baseStage({
        stageApproval: {
          status: "approved",
          inputHash: expectedHash(stage),
          expiresAt: null,
          consumedAt: null,
        },
      }),
    );
    expect(facts.approvalSatisfied).toBe(true);
  });

  it("medium-risk with pending approval → approvalSatisfied false", async () => {
    const svc = buildService();
    const stage = baseStage({});
    const facts = await svc.assembleFacts(
      baseStage({
        stageApproval: {
          status: "pending",
          inputHash: expectedHash(stage),
          expiresAt: null,
          consumedAt: null,
        },
      }),
    );
    expect(facts.approvalSatisfied).toBe(false);
  });

  it("medium-risk with approved but mismatched inputHash → false", async () => {
    const svc = buildService();
    const facts = await svc.assembleFacts(
      baseStage({
        stageApproval: {
          status: "approved",
          inputHash: "stale-hash",
          expiresAt: null,
          consumedAt: null,
        },
      }),
    );
    expect(facts.approvalSatisfied).toBe(false);
  });

  it("medium-risk with consumed approval → false", async () => {
    const svc = buildService();
    const stage = baseStage({});
    const facts = await svc.assembleFacts(
      baseStage({
        stageApproval: {
          status: "approved",
          inputHash: expectedHash(stage),
          expiresAt: null,
          consumedAt: new Date(),
        },
      }),
    );
    expect(facts.approvalSatisfied).toBe(false);
  });

  it("medium-risk with expired approval → false", async () => {
    const svc = buildService();
    const stage = baseStage({});
    const past = new Date(Date.now() - 60_000);
    const facts = await svc.assembleFacts(
      baseStage({
        stageApproval: {
          status: "approved",
          inputHash: expectedHash(stage),
          expiresAt: past,
          consumedAt: null,
        },
      }),
    );
    expect(facts.approvalSatisfied).toBe(false);
  });

  it("manual_gate without approval → false", async () => {
    const svc = buildService();
    const facts = await svc.assembleFacts(
      baseStage({ executorKind: "manual_gate", riskLevel: "low", stageApproval: null }),
    );
    expect(facts.approvalSatisfied).toBe(false);
  });

  it("manual_gate with approved matching approval → true", async () => {
    const svc = buildService();
    const stage = baseStage({ executorKind: "manual_gate", riskLevel: "low" });
    const facts = await svc.assembleFacts(
      baseStage({
        executorKind: "manual_gate",
        riskLevel: "low",
        stageApproval: {
          status: "approved",
          inputHash: expectedHash(stage),
          expiresAt: null,
          consumedAt: null,
        },
      }),
    );
    expect(facts.approvalSatisfied).toBe(true);
  });

  it("medium-risk with no stageApproval → false", async () => {
    const svc = buildService();
    const facts = await svc.assembleFacts(baseStage({ stageApproval: null }));
    expect(facts.approvalSatisfied).toBe(false);
  });
});
