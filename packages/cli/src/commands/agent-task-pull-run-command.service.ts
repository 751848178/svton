import { runAgentTaskPullLoop } from "../utils/agent-task-pull-loop-runner";
import type { AgentTaskPullLoopSummary } from "../utils/agent-task-pull-loop-summary.types";
import {
  buildAgentTaskPullStartupFailureLoopSummary,
  emitAgentTaskPullLoopSummaryResult,
  withAgentTaskPullLoopRunnerId,
} from "./agent-task-pull-command-result.service";
import { buildAgentTaskPullLoopConfig } from "./agent-task-pull-config";
import type { AgentTaskPullRunOptions } from "./agent-task-pull-config";
import { prepareAgentTaskPullRunStartup } from "./agent-task-pull-run-startup.service";
import { createAgentTaskPullStopController } from "./agent-task-pull-signal";
import type { AgentTaskPullStopController } from "./agent-task-pull-signal";

export async function agentTaskPullRun(options: AgentTaskPullRunOptions) {
  await runAgentTaskPullRunCommand(options);
}

export async function runAgentTaskPullRunCommand(
  options: AgentTaskPullRunOptions,
  deps: {
    createStopController?: () => AgentTaskPullStopController;
    runLoop?: typeof runAgentTaskPullLoop;
    logSummary?: (summary: AgentTaskPullLoopSummary) => void;
    setExitCode?: (code: number) => void;
    installPidFile?: (path: string) => () => void;
    logError?: (message: string) => void;
  } = {},
) {
  const config = buildAgentTaskPullLoopConfig(options);
  const stop =
    deps.createStopController?.() || createAgentTaskPullStopController();
  let cleanupPidFile: () => void = () => undefined;
  try {
    const startup = prepareAgentTaskPullRunStartup(
      { pidFile: options.pidFile },
      deps,
    );
    cleanupPidFile = startup.cleanupPidFile;
    if (!startup.shouldRun) {
      emitAgentTaskPullLoopSummaryResult(
        buildAgentTaskPullStartupFailureLoopSummary({
          startupError: startup.startupError,
          runnerId: config.runnerId,
        }),
        deps,
      );
      return;
    }
    const summary = await (deps.runLoop || runAgentTaskPullLoop)(config, {
      signal: stop.signal,
    });
    emitAgentTaskPullLoopSummaryResult(
      withAgentTaskPullLoopRunnerId(summary, config.runnerId),
      deps,
    );
  } finally {
    cleanupPidFile();
    stop.cleanup();
  }
}
