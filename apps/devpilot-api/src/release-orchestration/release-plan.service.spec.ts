/**
 * ReleasePlanService 单元测试（F383 Slice 8a）：聚焦 preview ↔ create 哈希绑定
 * （invest-3 §C）。所有 DB/外部依赖 mock；仅验证 hash 比对逻辑与 409 行为。
 *
 * 集成路径（含 git-ref、env 校验端到端）由 release-coordinator.integration.spec.ts 覆盖。
 */
import { ConflictException } from "@nestjs/common";
import { ReleasePlanService } from "./release-plan.service";
import { RELEASE_ORCHESTRATION_FLAG } from "./types/release-orchestration.types";

function makeService({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const config = {
    get: (key: string, fallback?: string) =>
      key === RELEASE_ORCHESTRATION_FLAG
        ? enabled
          ? "true"
          : "false"
        : (fallback ?? ""),
  } as never;
  const planRepo = { persistPlanWithStages: jest.fn(async (input: never) => ({ id: "plan-1", planHash: "h" })) };
  const eventRepo = { append: jest.fn().mockResolvedValue(undefined) };
  const others = {} as never;
  const svc = new ReleasePlanService(
    config,
    others, // prisma
    planRepo as never,
    others, // stageRepo
    others, // attemptRepo
    eventRepo as never,
    others, // coordinator
    others, // approvalLifecycle
    others, // serverExecutor
  );
  return { svc, planRepo, eventRepo };
}

const validInput = {
  projectId: "p1",
  environmentId: "env-prod",
  name: "r1",
  services: [
    {
      applicationId: "a",
      applicationServiceId: "s",
      environmentId: "env-prod",
      serviceName: "svc",
      deployCommand: "make deploy",
    },
  ],
  teamId: "team-1",
  createdByUserId: "user-1",
};

describe("ReleasePlanService preview↔create hash binding (invest-3 §C)", () => {
  it("create with matching expectedPlanHash succeeds", async () => {
    const { svc } = makeService();
    const preview = await svc.preview(validInput);
    const created = await svc.create({ ...validInput, expectedPlanHash: preview.planHash });
    expect(created.planHash).toBe(preview.planHash);
  });

  it("create with mismatched expectedPlanHash → 409 ConflictException RELEASE_PLAN_STALE", async () => {
    const { svc } = makeService();
    await expect(
      svc.create({ ...validInput, expectedPlanHash: "stale-hash" }),
    ).rejects.toThrow(ConflictException);
    await expect(
      svc.create({ ...validInput, expectedPlanHash: "stale-hash" }),
    ).rejects.toMatchObject({
      response: {
        code: "RELEASE_PLAN_STALE",
        message: "预览已过期，请重新生成",
        expected: expect.any(String),
        received: "stale-hash",
      },
    });
  });

  // CR-3-F2：expectedPlanHash 现为必填——缺失不再静默绕过，而是抛 RELEASE_PLAN_STALE。
  // （DTO @IsNotEmpty 是第一道闸；这里覆盖 service 层即使被绕过 DTO 也拒绝。）
  it("create without expectedPlanHash → 409 RELEASE_PLAN_STALE (no silent bypass)", async () => {
    const { svc } = makeService();
    await expect(svc.create(validInput)).rejects.toMatchObject({
      response: {
        code: "RELEASE_PLAN_STALE",
        message: "预览已过期，请重新生成",
        expected: expect.any(String),
        received: undefined,
      },
    });
  });

  it("create fails fast when flag disabled (assertEnabled)", async () => {
    const { svc } = makeService({ enabled: false });
    await expect(svc.create(validInput)).rejects.toThrow();
  });
});
