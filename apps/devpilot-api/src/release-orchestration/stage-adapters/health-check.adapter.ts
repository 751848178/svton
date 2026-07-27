/**
 * 独立 health_check 阶段适配器：必须基于真实探针结果判成功。
 * 不以"进程已启动"或"HTTP 请求已发出"作为成功；只接受 2xx + 可选 body 断言。
 * 无 healthCheckUrl 配置时判 failed（不伪成功）。
 */
import { Injectable } from "@nestjs/common";
import type {
  ReleaseStageAdapter,
  ReleaseStageExecutionContext,
  ReleaseStageExecutionResult,
} from "./release-stage-adapter.types";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAXAttempts = 6;
const DEFAULT_INTERVAL_MS = 5_000;

export interface HealthCheckOutcome {
  ok: boolean;
  httpStatus?: number;
  error?: string;
  attempts: number;
}

@Injectable()
export class HealthCheckStageAdapter implements ReleaseStageAdapter {
  readonly kind = "server_command"; // 复用 server_command 的执行底座

  // health 检查需要同步等待真实结果，不能只排队后乐观成功。
  // 实现策略：把检查命令交给 server_command adapter 执行（curl 探针），
  // 这里只提供同步解释层；coordinator 调用本 adapter 时通过 server_executor 排队，
  // 然后在恢复链路用真实 job 终态判成功。本 execute 直接返回 queued。
  async execute(
    ctx: ReleaseStageExecutionContext,
  ): Promise<ReleaseStageExecutionResult> {
    const cfg = ctx.configSnapshot ?? {};
    const url = readString(cfg.healthCheckUrl);
    if (!url) {
      return {
        status: "failed",
        error: "health_check 阶段缺少 healthCheckUrl，无法探针",
      };
    }
    // 排队探针命令（curl），由 server executor 执行；终态由恢复链路回读
    return {
      status: "queued",
      logSummary: {
        healthCheckUrl: url,
        timeoutMs: readNumber(cfg.timeoutMs) ?? DEFAULT_TIMEOUT_MS,
        intervalMs: readNumber(cfg.intervalMs) ?? DEFAULT_INTERVAL_MS,
        maxAttempts: readNumber(cfg.maxAttempts) ?? DEFAULT_MAXAttempts,
      },
    };
  }
}

// 判定一次 HTTP 探针是否成功（白名单 2xx，可选 body 断言）
export function evaluateHealthProbe(
  httpStatus: number,
  body: string,
  expectBodyContains?: string,
): HealthCheckOutcome {
  const ok = httpStatus >= 200 && httpStatus < 300;
  if (!ok) {
    return { ok: false, httpStatus, attempts: 1, error: `HTTP ${httpStatus}` };
  }
  if (expectBodyContains && !body.includes(expectBodyContains)) {
    return {
      ok: false,
      httpStatus,
      attempts: 1,
      error: `响应体未包含期望片段`,
    };
  }
  return { ok: true, httpStatus, attempts: 1 };
}

function readString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function readNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
