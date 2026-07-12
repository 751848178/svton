import type { AgentTaskPullLoopSummary } from "./agent-task-pull-loop-summary.types";
import type { AgentTaskPullRunSummary } from "./agent-task-pull-runner";

type AgentTaskPullLoopStopConfig = {
  maxIterations?: number;
  idleLimit?: number;
};

export function readAgentTaskPullLoopStopReason(
  config: AgentTaskPullLoopStopConfig,
  runs: AgentTaskPullRunSummary[],
  idle: number,
) {
  if (runs[runs.length - 1]?.reason === "task_pull_disabled") {
    return "task_pull_disabled";
  }
  const iterations = runs.length;
  if (config.maxIterations && iterations >= config.maxIterations) {
    return "max_iterations";
  }
  if (config.idleLimit && idle >= config.idleLimit) {
    return "idle_limit";
  }
  return null;
}

export function buildAgentTaskPullLoopSummary(
  runs: AgentTaskPullRunSummary[],
  executed: number,
  idle: number,
  heartbeats: number,
  stoppedReason: AgentTaskPullLoopSummary["stoppedReason"],
  heartbeatError?: string,
  finishWritebackError?: string,
  pollError?: string,
): AgentTaskPullLoopSummary {
  return {
    mode: "loop",
    iterations: runs.length,
    executed,
    idle,
    heartbeats,
    stoppedReason,
    ...(heartbeatError ? { heartbeatError } : {}),
    ...(finishWritebackError ? { finishWritebackError } : {}),
    ...(pollError ? { pollError } : {}),
    runs,
  };
}

export function readAgentTaskPullFinishWritebackFailureReason(
  run: AgentTaskPullRunSummary,
) {
  if (run.finishAccepted === false) {
    return run.finishReason || "finish_writeback_rejected";
  }
  if (run.finishFinished === false) {
    return run.finishReason || "finish_writeback_not_finished";
  }
  return null;
}

export function formatAgentTaskPullLoopError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
