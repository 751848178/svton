import type { AgentTaskPullRunSummary } from "./agent-task-pull-runner";

export type AgentTaskPullLoopStoppedReason =
  | "max_iterations"
  | "idle_limit"
  | "signal"
  | "startup_failed"
  | "heartbeat_failed"
  | "poll_failed"
  | "task_pull_disabled"
  | "finish_writeback_failed";

export type AgentTaskPullLoopSummary = {
  mode: "loop";
  iterations: number;
  executed: number;
  idle: number;
  heartbeats: number;
  runnerId?: string;
  stoppedReason: AgentTaskPullLoopStoppedReason;
  startupError?: string;
  heartbeatError?: string;
  pollError?: string;
  finishWritebackError?: string;
  runs: AgentTaskPullRunSummary[];
};
