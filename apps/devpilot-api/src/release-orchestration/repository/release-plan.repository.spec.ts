/**
 * ReleasePlanRepository.persistPlanWithStages：幂等键重算验证。
 * 确认 stage 行写入时 idempotencyKey 用真实 plan.id 计算（非 "__plan__" 占位）。
 */
import { PrismaService } from "../../prisma/prisma.service";
import { ReleasePlanRepository } from "./release-plan.repository";
import { computeIdempotencyKey } from "../utils/release-hash.utils";

describe("ReleasePlanRepository.persistPlanWithStages idempotencyKey", () => {
  it("writes idempotencyKey computed from real plan.id (not __plan__ placeholder)", async () => {
    const PLAN_ID = "plan-real-id";
    const createdStages: Array<{ data: Record<string, unknown> }> = [];

    // 模拟事务客户端：plan.create 返回带 id 的 plan；stage.create 记录写入载荷。
    const tx = {
      releasePlan: {
        create: jest.fn().mockResolvedValue({ id: PLAN_ID }),
      },
      releaseStage: {
        create: jest.fn(async (args: { data: Record<string, unknown> }) => {
          createdStages.push({ data: args.data });
          return { id: "stage-1" };
        }),
        findMany: jest.fn().mockResolvedValue([{ id: "stage-1", key: "application_deploy:s" }]),
      },
      releaseStageDependency: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const repo = new ReleasePlanRepository(prisma as unknown as PrismaService);

    const result = await repo.persistPlanWithStages({
      teamId: "t1",
      projectId: "p1",
      environmentId: "e1",
      name: "r",
      planHash: "hash",
      inputSnapshot: {},
      stages: [
        {
          key: "application_deploy:s",
          name: "deploy",
          type: "application_deploy",
          executorKind: "deployment_run",
          configSnapshot: { deployCommand: "deploy" },
          configHash: "cfg-hash",
          riskLevel: "medium",
          required: true,
        },
      ],
      dependencies: [],
    });

    expect(result.id).toBe(PLAN_ID);
    expect(createdStages).toHaveLength(1);
    const written = createdStages[0].data;
    const expected = computeIdempotencyKey(
      PLAN_ID,
      "application_deploy:s",
      "cfg-hash",
    );
    expect(written.idempotencyKey).toBe(expected);
    expect(written.idempotencyKey).not.toContain("__plan__");
  });
});
