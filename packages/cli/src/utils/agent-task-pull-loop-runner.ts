import { HttpAgentTaskPullClient } from "./agent-task-pull-client";
import { HttpAgentHeartbeatClient } from "./agent-heartbeat-client";
import type {
  AgentHeartbeatClient,
  AgentHeartbeatConfig,
} from "./agent-heartbeat-types";
import type {
  AgentTaskPullConfig,
  AgentTaskPullExecutor,
  AgentTaskPullHttpClient,
} from "./agent-task-pull-types";
import type { AgentTaskPullLoopSummary } from "./agent-task-pull-loop-summary.types";
import { runAgentTaskPullOnce } from "./agent-task-pull-runner";
import type { AgentTaskPullRunSummary } from "./agent-task-pull-runner";
import { delayAgentTaskPullLoop } from "./agent-task-pull-loop-delay.utils";
import {
  buildAgentTaskPullLoopSummary,
  formatAgentTaskPullLoopError,
  readAgentTaskPullFinishWritebackFailureReason,
  readAgentTaskPullLoopStopReason,
} from "./agent-task-pull-loop-summary.utils";
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
      return buildAgentTaskPullLoopSummary(
        runs,
        executed,
        idle,
        heartbeats,
        "signal",
      );
    }
    if (config.heartbeat) {
      try {
        const heartbeat = await heartbeatClient.heartbeat(config.heartbeat);
        if (heartbeat.accepted === false) {
          return buildAgentTaskPullLoopSummary(
            runs,
            executed,
            idle,
            heartbeats,
            "heartbeat_failed",
            "heartbeat rejected",
          );
        }
      } catch (error) {
        return buildAgentTaskPullLoopSummary(
          runs,
          executed,
          idle,
          heartbeats,
          "heartbeat_failed",
          formatAgentTaskPullLoopError(error),
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
      return buildAgentTaskPullLoopSummary(
        runs,
        executed,
        idle,
        heartbeats,
        "poll_failed",
        undefined,
        undefined,
        formatAgentTaskPullLoopError(error),
      );
    }
    runs.push(run);
    if (run.mode === "executed") {
      executed += 1;
      idle = 0;
    } else {
      idle += 1;
    }
    const finishWritebackError =
      readAgentTaskPullFinishWritebackFailureReason(run);
    if (finishWritebackError) {
      return buildAgentTaskPullLoopSummary(
        runs,
        executed,
        idle,
        heartbeats,
        "finish_writeback_failed",
        undefined,
        finishWritebackError,
      );
    }

    const stoppedReason = readAgentTaskPullLoopStopReason(config, runs, idle);
    if (stoppedReason) {
      return buildAgentTaskPullLoopSummary(
        runs,
        executed,
        idle,
        heartbeats,
        stoppedReason,
      );
    }
    if (config.intervalMs > 0) {
      await sleep(config.intervalMs, deps.signal);
    }
  }
}
