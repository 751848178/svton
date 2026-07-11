import { HttpAgentTaskPullClient } from "./agent-task-pull-client";
import { HttpAgentHeartbeatClient } from "./agent-heartbeat-client";
import type {
  AgentHeartbeatClient,
  AgentHeartbeatConfig,
} from "./agent-heartbeat-types";
import type {
  AgentTaskPullConfig,
  AgentTaskPullHttpClient,
} from "./agent-task-pull-types";
import type { AgentTaskPullExecutor } from "./agent-task-pull-executor";
import type { AgentTaskPullLoopSummary } from "./agent-task-pull-loop-summary.types";
import { runAgentTaskPullOnce } from "./agent-task-pull-runner";
import type { AgentTaskPullRunSummary } from "./agent-task-pull-runner";
import { delayAgentTaskPullLoop } from "./agent-task-pull-loop-delay.utils";
export type AgentTaskPullLoopConfig = AgentTaskPullConfig & {
  intervalMs: number;
  maxIterations?: number;
  idleLimit?: number;
  heartbeat?: AgentHeartbeatConfig;
};

export async function runAgentTaskPullLoop(
  config: AgentTaskPullLoopConfig,
  deps: {
    client?: AgentTaskPullHttpClient;
    heartbeatClient?: AgentHeartbeatClient;
    executor?: AgentTaskPullExecutor;
    signal?: AbortSignal;
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  } = {},
): Promise<AgentTaskPullLoopSummary> {
  const client = deps.client || new HttpAgentTaskPullClient(config);
  const heartbeatClient =
    deps.heartbeatClient || new HttpAgentHeartbeatClient();
  const sleep = deps.sleep || delayAgentTaskPullLoop;
  const runs: AgentTaskPullRunSummary[] = [];
  let executed = 0;
  let idle = 0;
  let heartbeats = 0;

  for (;;) {
    if (deps.signal?.aborted) {
      return buildSummary(runs, executed, idle, heartbeats, "signal");
    }
    if (config.heartbeat) {
      try {
        const heartbeat = await heartbeatClient.heartbeat(config.heartbeat);
        if (heartbeat.accepted === false) {
          return buildSummary(
            runs,
            executed,
            idle,
            heartbeats,
            "heartbeat_failed",
            "heartbeat rejected",
          );
        }
      } catch (error) {
        return buildSummary(
          runs,
          executed,
          idle,
          heartbeats,
          "heartbeat_failed",
          errorMessage(error),
        );
      }
      heartbeats += 1;
    }
    let run: AgentTaskPullRunSummary;
    try {
      run = await runAgentTaskPullOnce(
        { ...config, execute: true },
        {
          client,
          executor: deps.executor,
          signal: deps.signal,
          ackRenewalIntervalMs: config.ackRenewalIntervalMs,
        },
      );
    } catch (error) {
      return buildSummary(
        runs,
        executed,
        idle,
        heartbeats,
        "poll_failed",
        undefined,
        undefined,
        errorMessage(error),
      );
    }
    runs.push(run);
    if (run.mode === "executed") {
      executed += 1;
      idle = 0;
    } else {
      idle += 1;
    }
    const finishWritebackError = finishWritebackFailureReason(run);
    if (finishWritebackError) {
      return buildSummary(
        runs,
        executed,
        idle,
        heartbeats,
        "finish_writeback_failed",
        undefined,
        finishWritebackError,
      );
    }

    const stoppedReason = stopReason(config, runs, idle);
    if (stoppedReason) {
      return buildSummary(runs, executed, idle, heartbeats, stoppedReason);
    }
    if (config.intervalMs > 0) {
      await sleep(config.intervalMs, deps.signal);
    }
  }
}

function stopReason(
  config: AgentTaskPullLoopConfig,
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

function buildSummary(
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

function finishWritebackFailureReason(run: AgentTaskPullRunSummary) {
  if (run.finishAccepted === false) {
    return run.finishReason || "finish_writeback_rejected";
  }
  if (run.finishFinished === false) {
    return run.finishReason || "finish_writeback_not_finished";
  }
  return null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
