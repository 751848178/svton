import { ReleaseApprovalLifecycleService } from "./release-approval-lifecycle.service";
import { expectedStageInputHash } from "./utils/release-approval-predicate.utils";
import type { LifecyclePlanView, LifecycleStageView } from "./release-approval-lifecycle.service";

const STAGE_BASE: LifecycleStageView = {
  id: "stage-1",
  releasePlanId: "plan-1",
  teamId: "team-1",
  key: "schema_migration:svc",
  name: "迁移",
  type: "schema_migration",
  executorKind: "server_command",
  riskLevel: "medium",
  applicationId: null,
  applicationServiceId: "svc-1",
  environmentId: "env-1",
  serverId: null,
  configHash: "hash-v1",
};

const PLAN_BASE: LifecyclePlanView = {
  id: "plan-1",
  teamId: "team-1",
  projectId: "proj-1",
  environmentId: "env-1",
  name: "发布 X",
  createdByUserId: "user-1",
};

function buildService(overrides: {
  findLatestForTarget?: ReturnType<typeof jest.fn>;
  createPending?: ReturnType<typeof jest.fn>;
  consume?: ReturnType<typeof jest.fn>;
  cancel?: ReturnType<typeof jest.fn>;
  updateStatusIf?: ReturnType<typeof jest.fn>;
  append?: ReturnType<typeof jest.fn>;
}) {
  const approvalRepo = {
    findLatestForTarget:
      overrides.findLatestForTarget ?? jest.fn().mockResolvedValue(null),
    cancel: overrides.cancel ?? jest.fn().mockResolvedValue(1),
  };
  const approvalService = {
    createPending:
      overrides.createPending ??
      jest.fn().mockResolvedValue({
        id: "appr-new",
        status: "pending",
        inputHash: expectedStageInputHash({
          releasePlanId: PLAN_BASE.id,
          key: STAGE_BASE.key,
          environmentId: PLAN_BASE.environmentId,
          configHash: STAGE_BASE.configHash,
        }),
        expiresAt: null,
        consumedAt: null,
      }),
    consume: overrides.consume ?? jest.fn().mockResolvedValue({ count: 1 }),
  };
  const stageRepo = { updateStatusIf: overrides.updateStatusIf ?? jest.fn().mockResolvedValue(1) };
  const eventRepo = { append: overrides.append ?? jest.fn().mockResolvedValue({}) };
  const service = new ReleaseApprovalLifecycleService(
    approvalService as any,
    approvalRepo as any,
    stageRepo as any,
    eventRepo as any,
  );
  return { service, approvalRepo, approvalService, stageRepo, eventRepo };
}

describe("ReleaseApprovalLifecycleService.ensureStageApproval", () => {
  beforeEach(() => jest.clearAllMocks());

  it("(a) low-risk stage → no approval created", async () => {
    const { service, approvalService, approvalRepo } = buildService({});
    const res = await service.ensureStageApproval(
      { ...STAGE_BASE, riskLevel: "low" },
      PLAN_BASE,
    );
    expect(res.blocked).toBe(false);
    expect(res.approval).toBeNull();
    expect(approvalRepo.findLatestForTarget).not.toHaveBeenCalled();
    expect(approvalService.createPending).not.toHaveBeenCalled();
  });

  it("(b) medium-risk stage with no existing approval → createPending called once with correct inputHash", async () => {
    const { service, approvalService } = buildService({});
    const res = await service.ensureStageApproval(STAGE_BASE, PLAN_BASE);
    expect(res.blocked).toBe(false);
    expect(approvalService.createPending).toHaveBeenCalledTimes(1);
    const input = approvalService.createPending.mock.calls[0][0];
    const expected = expectedStageInputHash({
      releasePlanId: PLAN_BASE.id,
      key: STAGE_BASE.key,
      environmentId: PLAN_BASE.environmentId,
      configHash: STAGE_BASE.configHash,
    });
    expect(input.inputHash).toBe(expected);
    expect(input.targetType).toBe("release_stage");
    expect(input.targetId).toBe(STAGE_BASE.id);
    expect(input.risk).toBe("medium");
  });

  it("(c) medium-risk with existing pending matching inputHash → no new createPending", async () => {
    const hash = expectedStageInputHash({
      releasePlanId: PLAN_BASE.id,
      key: STAGE_BASE.key,
      environmentId: PLAN_BASE.environmentId,
      configHash: STAGE_BASE.configHash,
    });
    const { service, approvalService } = buildService({
      findLatestForTarget: jest.fn().mockResolvedValue({
        id: "appr-old",
        status: "pending",
        inputHash: hash,
        expiresAt: null,
        consumedAt: null,
        reviewComment: null,
      }),
    });
    const res = await service.ensureStageApproval(STAGE_BASE, PLAN_BASE);
    expect(res.blocked).toBe(false);
    expect(res.approval?.status).toBe("pending");
    expect(approvalService.createPending).not.toHaveBeenCalled();
  });

  it("(d) medium-risk with existing rejected approval → stage set blocked, no new pending", async () => {
    const { service, approvalService, stageRepo, eventRepo } = buildService({
      findLatestForTarget: jest.fn().mockResolvedValue({
        id: "appr-rej",
        status: "rejected",
        inputHash: "any",
        expiresAt: null,
        consumedAt: null,
        reviewComment: "高风险时段",
      }),
    });
    const res = await service.ensureStageApproval(STAGE_BASE, PLAN_BASE);
    expect(res.blocked).toBe(true);
    expect(res.approval?.status).toBe("rejected");
    expect(approvalService.createPending).not.toHaveBeenCalled();
    expect(stageRepo.updateStatusIf).toHaveBeenCalledWith(
      STAGE_BASE.id,
      ["pending", "blocked", "awaiting_approval"],
      { status: "blocked", blockedReason: "审批被拒绝：高风险时段" },
    );
    expect(eventRepo.append).toHaveBeenCalledWith(
      expect.objectContaining({ releaseStageId: STAGE_BASE.id }),
    );
  });

  it("(e) medium-risk with pending but mismatched inputHash (config changed) → fresh createPending", async () => {
    const { service, approvalService } = buildService({
      findLatestForTarget: jest.fn().mockResolvedValue({
        id: "appr-stale",
        status: "pending",
        inputHash: "stale-hash",
        expiresAt: null,
        consumedAt: null,
        reviewComment: null,
      }),
    });
    const res = await service.ensureStageApproval(STAGE_BASE, PLAN_BASE);
    expect(res.blocked).toBe(false);
    expect(approvalService.createPending).toHaveBeenCalledTimes(1);
    expect(approvalService.createPending.mock.calls[0][0].inputHash).not.toBe("stale-hash");
  });

  // CR-2-1 回归：approved + matching hash → 不再 mint 第二个 pending（旧实现死锁根因）
  it("(c2) approved + matching inputHash + not consumed + not expired → no createPending", async () => {
    const hash = expectedStageInputHash({
      releasePlanId: PLAN_BASE.id,
      key: STAGE_BASE.key,
      environmentId: PLAN_BASE.environmentId,
      configHash: STAGE_BASE.configHash,
    });
    const { service, approvalService } = buildService({
      findLatestForTarget: jest.fn().mockResolvedValue({
        id: "appr-approved",
        status: "approved",
        inputHash: hash,
        expiresAt: null,
        consumedAt: null,
        reviewComment: "ok",
      }),
    });
    const res = await service.ensureStageApproval(STAGE_BASE, PLAN_BASE);
    expect(res.blocked).toBe(false);
    expect(res.approval?.status).toBe("approved");
    expect(approvalService.createPending).not.toHaveBeenCalled();
  });

  // CR-2-1 回归：approved 但 inputHash stale（配置变更）→ 必须重新 createPending
  it("(c3) approved + stale inputHash (config changed) → fresh createPending", async () => {
    const { service, approvalService } = buildService({
      findLatestForTarget: jest.fn().mockResolvedValue({
        id: "appr-approved-stale",
        status: "approved",
        inputHash: "stale-approved-hash",
        expiresAt: null,
        consumedAt: null,
        reviewComment: null,
      }),
    });
    const res = await service.ensureStageApproval(STAGE_BASE, PLAN_BASE);
    expect(res.blocked).toBe(false);
    expect(approvalService.createPending).toHaveBeenCalledTimes(1);
    expect(approvalService.createPending.mock.calls[0][0].inputHash).not.toBe("stale-approved-hash");
  });

  it("(f) expired pending → fresh createPending", async () => {
    const hash = expectedStageInputHash({
      releasePlanId: PLAN_BASE.id,
      key: STAGE_BASE.key,
      environmentId: PLAN_BASE.environmentId,
      configHash: STAGE_BASE.configHash,
    });
    const past = new Date(Date.now() - 60_000);
    const { service, approvalService } = buildService({
      findLatestForTarget: jest.fn().mockResolvedValue({
        id: "appr-expired",
        status: "pending",
        inputHash: hash,
        expiresAt: past,
        consumedAt: null,
        reviewComment: null,
      }),
    });
    const res = await service.ensureStageApproval(STAGE_BASE, PLAN_BASE);
    expect(res.blocked).toBe(false);
    expect(approvalService.createPending).toHaveBeenCalledTimes(1);
  });

  it("manual_gate low-risk still requires approval", async () => {
    const { service, approvalService } = buildService({});
    const res = await service.ensureStageApproval(
      { ...STAGE_BASE, riskLevel: "low", executorKind: "manual_gate" },
      PLAN_BASE,
    );
    expect(approvalService.createPending).toHaveBeenCalledTimes(1);
    expect(res.blocked).toBe(false);
  });
});

describe("ReleaseApprovalLifecycleService.consume / voidLatestRejected", () => {
  beforeEach(() => jest.clearAllMocks());

  it("consume swallows errors and does not throw", async () => {
    const { service, approvalService } = buildService({
      consume: jest.fn().mockRejectedValue(new Error("boom")),
    });
    await expect(service.consume("team-1", "appr-1")).resolves.toBeUndefined();
    expect(approvalService.consume).toHaveBeenCalledWith("team-1", "appr-1");
  });

  it("consume no-op when approvalId missing", async () => {
    const { service, approvalService } = buildService({});
    await service.consume("team-1", null);
    expect(approvalService.consume).not.toHaveBeenCalled();
  });

  it("voidLatestRejected cancels only rejected latest", async () => {
    const { service, approvalRepo } = buildService({
      findLatestForTarget: jest.fn().mockResolvedValue({
        id: "appr-rej",
        status: "rejected",
        inputHash: null,
        expiresAt: null,
        consumedAt: null,
        reviewComment: null,
      }),
    });
    const count = await service.voidLatestRejected("team-1", "stage-1");
    expect(count).toBe(1);
    expect(approvalRepo.cancel).toHaveBeenCalledWith("appr-rej", "rejected");
  });

  it("voidLatestRejected no-op when latest not rejected", async () => {
    const { service, approvalRepo } = buildService({
      findLatestForTarget: jest.fn().mockResolvedValue({
        id: "appr-pending",
        status: "pending",
        inputHash: null,
        expiresAt: null,
        consumedAt: null,
        reviewComment: null,
      }),
    });
    const count = await service.voidLatestRejected("team-1", "stage-1");
    expect(count).toBe(0);
    expect(approvalRepo.cancel).not.toHaveBeenCalled();
  });
});
