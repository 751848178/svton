import { logger } from "../utils/logger";
import { installAgentTaskPullPidFile } from "./agent-task-pull-pid-file";

export type AgentTaskPullRunStartupOptions = {
  pidFile?: string;
};

export type AgentTaskPullRunStartupDeps = {
  installPidFile?: (path: string) => () => void;
  logError?: (message: string) => void;
  setExitCode?: (code: number) => void;
};

export type AgentTaskPullRunStartupResult = {
  shouldRun: boolean;
  cleanupPidFile: () => void;
  startupError?: string;
};

export function prepareAgentTaskPullRunStartup(
  options: AgentTaskPullRunStartupOptions,
  deps: AgentTaskPullRunStartupDeps = {},
): AgentTaskPullRunStartupResult {
  try {
    return {
      shouldRun: true,
      cleanupPidFile: installStartupPidFile(options, deps),
    };
  } catch (error) {
    const startupError = formatErrorMessage(error);
    (deps.logError || logTaskPullStartupError)(startupError);
    (deps.setExitCode || setProcessExitCode)(1);
    return {
      shouldRun: false,
      cleanupPidFile: () => undefined,
      startupError,
    };
  }
}

function installStartupPidFile(
  options: AgentTaskPullRunStartupOptions,
  deps: AgentTaskPullRunStartupDeps,
) {
  if (!options.pidFile) {
    return () => undefined;
  }
  return (deps.installPidFile || installAgentTaskPullPidFile)(options.pidFile);
}

function logTaskPullStartupError(message: string) {
  logger.error(`Task-pull run startup failed: ${message}`);
}

function setProcessExitCode(code: number) {
  process.exitCode = code;
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
