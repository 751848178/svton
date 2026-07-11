import { runAgentTaskPullOnce } from "../utils/agent-task-pull-runner";
import type { AgentTaskPullRunSummary } from "../utils/agent-task-pull-runner";
import { emitAgentTaskPullOnceSummaryResult } from "./agent-task-pull-command-result.service";
import { buildAgentTaskPullConfig } from "./agent-task-pull-config";
import type { AgentTaskPullOnceOptions } from "./agent-task-pull-config";
import { createAgentTaskPullStopController } from "./agent-task-pull-signal";
import type { AgentTaskPullStopController } from "./agent-task-pull-signal";

export async function agentTaskPullOnce(options: AgentTaskPullOnceOptions) {
  await runAgentTaskPullOnceCommand(options);
}

export async function runAgentTaskPullOnceCommand(
  options: AgentTaskPullOnceOptions,
  deps: {
    createStopController?: () => AgentTaskPullStopController;
    runOnce?: typeof runAgentTaskPullOnce;
    logSummary?: (summary: AgentTaskPullRunSummary) => void;
    setExitCode?: (code: number) => void;
  } = {},
) {
  const config = buildAgentTaskPullConfig(options);
  const stop =
    deps.createStopController?.() || createAgentTaskPullStopController();
  try {
    const summary = await (deps.runOnce || runAgentTaskPullOnce)(config, {
      signal: stop.signal,
      ackRenewalIntervalMs: config.ackRenewalIntervalMs,
    });
    emitAgentTaskPullOnceSummaryResult(summary, deps);
  } finally {
    stop.cleanup();
  }
}
