/**
 * health_check 阶段适配器（D7）：构造 shell-safe curl 探针命令，委托
 * ServerCommandStageAdapter.queue 在目标主机上执行（沿用既有 SSH/Agent 传输）。
 *
 * 成功语义：maxAttempts 次内任一一次返回 2xx 且（若设置）body 命中 → curl 退出 0
 * 且输出 @@DEVPILOT_OUTPUT@@ 哨兵（ready:true, httpStatus:2xx）；耗尽则退出 1。
 * 终态由恢复链路/完成同步从 ServerExecutionJob 回读后由 interpret 层解析。
 *
 * 安全：URL 经 new URL 解析 + 协议白名单 + 重新序列化 + POSIX 单引号转义嵌入；
 * 任何 shell 元字符都被单引号包裹，命令注入不可行（见 health-check-curl.utils）。
 */
import { Injectable } from "@nestjs/common";
import { buildHealthCheckCurlCommand } from "./health-check-curl.utils";
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./release-stage-adapter.types";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_INTERVAL_MS = 5_000;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

@Injectable()
export class HealthCheckStageAdapter implements ReleaseStageAdapter {
  readonly kind = "server_command"; // 复用 server_command 执行底座（SEJ + SSH/Agent）

  constructor(
    private readonly serverCommandAdapter: ReleaseStageAdapter & {
      queue?: (
        ctx: ReleaseStageExecutionContext,
      ) => Promise<ReleaseStageExecutionResult>;
    },
  ) {}

  async execute(
    ctx: ReleaseStageExecutionContext,
  ): Promise<ReleaseStageExecutionResult> {
    const cfg = ctx.configSnapshot ?? {};
    const rawUrl = readString(cfg.healthCheckUrl);
    if (!rawUrl) {
      return {
        status: "failed",
        error: "health_check 缺少 healthCheckUrl 配置",
      };
    }
    // URL 解析 + 协议白名单。new URL 对绝大多数畸形输入直接抛 TypeError；
    // 协议校验在解析成功后做，防止 ftp:/javascript: 等被当成探针目标。
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { status: "failed", error: "health_check URL 无效" };
    }
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return {
        status: "failed",
        error: "health_check URL 协议必须是 http/https",
      };
    }

    const timeoutMs = readNumber(cfg.timeoutMs) ?? DEFAULT_TIMEOUT_MS;
    const intervalMs = readNumber(cfg.intervalMs) ?? DEFAULT_INTERVAL_MS;
    const maxAttempts = readNumber(cfg.maxAttempts) ?? DEFAULT_MAX_ATTEMPTS;
    const expectBodyContains = readString(cfg.expectBodyContains);

    const command = buildHealthCheckCurlCommand(parsed, {
      timeoutMs,
      intervalMs,
      maxAttempts,
      expectBodyContains,
    });

    // 委托 server_command adapter 在目标主机排队执行 curl 循环。
    // 保留原 configSnapshot 字段（__stageType 等路由元信息），仅覆盖 command。
    const delegateCtx: ReleaseStageExecutionContext = {
      ...ctx,
      configSnapshot: { ...cfg, command },
    };
    const queued = this.serverCommandAdapter.queue
      ? await this.serverCommandAdapter.queue(delegateCtx)
      : await this.serverCommandAdapter.execute(delegateCtx);

    // 去标识化探针配置摘要：只保留 host/port，剥离完整 URL/path/query。
    // 每次探针的真实结果（httpStatus/latency）在 SEJ 日志里，由完成同步经
    // D10 脱敏后写入 attempt.logSummary；此处仅记录静态配置。
    return {
      ...queued,
      logSummary: {
        host: parsed.host,
        port: parsed.port || null,
        maxAttempts,
        timeoutMs,
        intervalMs,
        expect: expectBodyContains ? "set" : "none",
      },
    };
  }
}

function readString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function readNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
