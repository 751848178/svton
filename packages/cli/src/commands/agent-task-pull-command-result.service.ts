import { logger } from "../utils/logger";
import type { AgentTaskPullLoopConfig } from "../utils/agent-task-pull-loop-runner";
import type {
  AgentTaskPullLoopSummary,
  AgentTaskPullRunRuntimeProfile,
} from "../utils/agent-task-pull-loop-summary.types";
import type { AgentTaskPullRunSummary } from "../utils/agent-task-pull-runner";

type AgentTaskPullSummaryResultDeps<Summary> = {
  logSummary?: (summary: Summary) => void;
  setExitCode?: (code: number) => void;
};

export function buildAgentTaskPullStartupFailureLoopSummary(params: {
  startupError?: string;
  runnerId?: string;
}): AgentTaskPullLoopSummary {
  return {
    mode: "loop",
    iterations: 0,
    executed: 0,
    idle: 0,
    heartbeats: 0,
    stoppedReason: "startup_failed",
    ...(params.startupError ? { startupError: params.startupError } : {}),
    ...(params.runnerId ? { runnerId: params.runnerId } : {}),
    runs: [],
  };
}

export function withAgentTaskPullLoopRunnerId(
  summary: AgentTaskPullLoopSummary,
  runnerId?: string,
): AgentTaskPullLoopSummary {
  if (!runnerId) return summary;
  return {
    ...summary,
    runnerId,
  };
}

export function buildAgentTaskPullRunRuntimeProfile(
  config: AgentTaskPullLoopConfig,
  options: { forever?: boolean; pidFile?: string } = {},
): AgentTaskPullRunRuntimeProfile {
  return {
    processId: process.pid,
    runnerId: config.runnerId,
    pidFileConfigured: Boolean(options.pidFile),
    ...(options.pidFile ? { pidFile: options.pidFile } : {}),
    heartbeatConfigured: Boolean(config.heartbeat),
    ...(config.heartbeat?.status
      ? { heartbeatStatus: config.heartbeat.status }
      : {}),
    ...(config.heartbeat?.ttlSeconds
      ? { heartbeatTtlSeconds: config.heartbeat.ttlSeconds }
      : {}),
    loop: {
      intervalMs: config.intervalMs,
      forever: Boolean(options.forever),
      ...(config.maxIterations !== undefined
        ? { maxIterations: config.maxIterations }
        : {}),
      ...(config.idleLimit !== undefined
        ? { idleLimit: config.idleLimit }
        : {}),
    },
    ...(config.ackRenewalIntervalMs !== undefined
      ? { ackRenewalIntervalMs: config.ackRenewalIntervalMs }
      : {}),
    ...(config.forceKillGraceMs !== undefined
      ? { forceKillGraceMs: config.forceKillGraceMs }
      : {}),
  };
}

export function withAgentTaskPullRunRuntimeProfile(
  summary: AgentTaskPullLoopSummary,
  runtimeProfile: AgentTaskPullRunRuntimeProfile,
): AgentTaskPullLoopSummary {
  return {
    ...summary,
    runtimeProfile,
  };
}

export function emitAgentTaskPullOnceSummaryResult(
  summary: AgentTaskPullRunSummary,
  deps: AgentTaskPullSummaryResultDeps<AgentTaskPullRunSummary> = {},
) {
  (deps.logSummary || logAgentTaskPullSummary)(summary);
  if (isAgentTaskPullOnceFailureSummary(summary)) {
    (deps.setExitCode || setProcessExitCode)(1);
  }
}

export function emitAgentTaskPullLoopSummaryResult(
  summary: AgentTaskPullLoopSummary,
  deps: AgentTaskPullSummaryResultDeps<AgentTaskPullLoopSummary> = {},
) {
  (deps.logSummary || logAgentTaskPullLoopSummary)(summary);
  if (isAgentTaskPullLoopFailureStopReason(summary.stoppedReason)) {
    (deps.setExitCode || setProcessExitCode)(1);
  }
}

export function logAgentTaskPullSummary(summary: AgentTaskPullRunSummary) {
  logger.info(JSON.stringify(summary, null, 2));
}

export function logAgentTaskPullLoopSummary(summary: AgentTaskPullLoopSummary) {
  logger.info(JSON.stringify(summary, null, 2));
}

export function isAgentTaskPullOnceFailureSummary(
  summary: AgentTaskPullRunSummary,
) {
  if (summary.mode !== "executed") return false;
  return (
    summary.status === "failed" ||
    summary.status === "cancelled" ||
    summary.finishAccepted === false ||
    summary.finishFinished === false
  );
}

export function isAgentTaskPullLoopFailureStopReason(
  stoppedReason: AgentTaskPullLoopSummary["stoppedReason"],
) {
  return (
    stoppedReason === "heartbeat_failed" ||
    stoppedReason === "poll_failed" ||
    stoppedReason === "finish_writeback_failed"
  );
}

export function setProcessExitCode(code: number) {
  process.exitCode = code;
}
