/**
 * HealthCheckStageAdapter 单测（F383 D7 step 2）：
 * - URL 校验（缺失/无效/非 http 协议）→ 立即 failed
 * - 合法 URL + 协议 → 委托 ServerCommandStageAdapter.queue，queued 结果透传
 * - logSummary 去标识化（仅 host/port，无完整 URL）
 */
import { HealthCheckStageAdapter } from "./health-check.adapter";
import { ServerCommandStageAdapter } from "./server-command.adapter";
import type {
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./release-stage-adapter.types";

function mkCtx(
  configSnapshot: Record<string, unknown>,
): ReleaseStageExecutionContext {
  return {
    releasePlanId: "plan-1",
    releaseStageId: "stage-1",
    attemptId: "att-1",
    teamId: "team-1",
    projectId: "proj-1",
    environmentId: "env-1",
    applicationId: null,
    applicationServiceId: null,
    serverId: null,
    configSnapshot,
    configHash: "h-1",
    actorId: "u-1",
    operationApprovalId: null,
  };
}

describe("HealthCheckStageAdapter.execute", () => {
  it("fails when healthCheckUrl missing", async () => {
    const delegate = { execute: jest.fn(), queue: jest.fn() };
    const adapter = new HealthCheckStageAdapter(delegate as never);
    const r = await adapter.execute(mkCtx({}));
    expect(r.status).toBe("failed");
    expect(r.error).toMatch(/缺少 healthCheckUrl/);
    expect(delegate.queue).not.toHaveBeenCalled();
  });

  it("fails when URL is malformed", async () => {
    const delegate = { execute: jest.fn(), queue: jest.fn() };
    const adapter = new HealthCheckStageAdapter(delegate as never);
    const r = await adapter.execute(mkCtx({ healthCheckUrl: "not-a-url" }));
    expect(r.status).toBe("failed");
    expect(r.error).toMatch(/URL 无效/);
  });

  it("fails when protocol is not http/https", async () => {
    const delegate = { execute: jest.fn(), queue: jest.fn() };
    const adapter = new HealthCheckStageAdapter(delegate as never);
    const r = await adapter.execute(
      mkCtx({ healthCheckUrl: "ftp://example.com/health" }),
    );
    expect(r.status).toBe("failed");
    expect(r.error).toMatch(/http\/https/);
  });

  it("delegates to ServerCommandStageAdapter.queue with curl command and de-identified logSummary", async () => {
    const queued: ReleaseStageExecutionResult = {
      status: "queued",
      serverExecutionJobId: "sej-1",
    };
    // HealthCheckStageAdapter 现注入具体 ServerCommandStageAdapter（Nest 按类 token 解析）。
    // 测试只需 queue 方法行为，用 partial mock + as ServerCommandStageAdapter 满足构造签名。
    const delegate = {
      kind: "server_command" as const,
      execute: jest.fn(),
      queue: jest.fn().mockResolvedValue(queued),
    } as unknown as ServerCommandStageAdapter;
    const adapter = new HealthCheckStageAdapter(delegate);
    const r = await adapter.execute(
      mkCtx({
        healthCheckUrl: "http://127.0.0.1:4100/api/health/readiness",
        timeoutMs: 8000,
        intervalMs: 4000,
        maxAttempts: 4,
        expectBodyContains: '"ready":true',
      }),
    );

    expect(delegate.queue).toHaveBeenCalledTimes(1);
    const queueMock = delegate.queue as unknown as jest.Mock;
    const passedCtx = queueMock.mock.calls[0][0];
    const cmd = (passedCtx.configSnapshot as { command: string }).command;
    // 委托命令是 curl 循环
    expect(cmd).toContain("for i in $(seq 1 4)");
    expect(cmd).toContain("--max-time 8");
    expect(cmd).toContain("curl ");
    expect(cmd).toContain("'http://127.0.0.1:4100/api/health/readiness'");
    expect(cmd).toContain("grep -qF");

    // 透传 queued 结果 + 去标识化 logSummary（无完整 URL/path，仅 host/port）
    expect(r.status).toBe("queued");
    expect(r.serverExecutionJobId).toBe("sej-1");
    expect(r.logSummary).toEqual({
      host: "127.0.0.1:4100",
      port: "4100",
      maxAttempts: 4,
      timeoutMs: 8000,
      intervalMs: 4000,
      expect: "set",
    });
    expect(JSON.stringify(r.logSummary)).not.toContain("/api/health");
  });

  it("uses default probe config when optional fields missing", async () => {
    const delegate = {
      kind: "server_command",
      execute: jest.fn(),
      queue: jest.fn().mockResolvedValue({ status: "queued" }),
    } as never;
    const adapter = new HealthCheckStageAdapter(delegate);
    const r = await adapter.execute(
      mkCtx({ healthCheckUrl: "http://x/" }),
    );
    expect(r.logSummary).toEqual({
      host: "x",
      port: null,
      maxAttempts: 6,
      timeoutMs: 10_000,
      intervalMs: 5_000,
      expect: "none",
    });
  });

  it("falls back to execute when delegate has no queue method", async () => {
    const delegate = {
      kind: "server_command",
      execute: jest.fn().mockResolvedValue({ status: "queued" } as never),
    } as never;
    const adapter = new HealthCheckStageAdapter(delegate);
    const r = await adapter.execute(
      mkCtx({ healthCheckUrl: "http://x/" }),
    );
    expect(r.status).toBe("queued");
  });
});
