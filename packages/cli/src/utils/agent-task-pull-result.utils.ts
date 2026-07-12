import type {
  AgentTaskPullCommandStep,
  AgentTaskPullFinishStatus,
  AgentTaskPullStepResult,
  AgentTaskPullTask,
} from "./agent-task-pull-types";

export function buildAgentTaskPullExecutionResult(
  status: AgentTaskPullFinishStatus,
  steps: AgentTaskPullStepResult[],
  error?: string,
) {
  return {
    status,
    error,
    logs: steps.flatMap((step) => [
      {
        level: step.exitCode === 0 ? "info" : "error",
        message: step.timedOut
          ? `step ${step.key} timed out`
          : `step ${step.key} exited with ${step.exitCode}`,
        stdout: step.stdout,
        stderr: step.stderr,
        ...(step.stdoutTruncated ? { stdoutTruncated: true } : {}),
        ...(step.stderrTruncated ? { stderrTruncated: true } : {}),
        ...(step.dryRunSkipped ? { dryRunSkipped: true } : {}),
      },
    ]),
    result: { mode: "cli_task_pull_once", status, steps },
  };
}

export function buildAgentTaskPullCommandPlan(task: AgentTaskPullTask) {
  return {
    mode: "cli_task_pull_once",
    lifecycleMode: task.lifecycle?.mode,
    dryRun: task.dryRun === true,
    commandSteps: task.commandSteps.map((step) => ({
      key: step.key,
      label: step.label,
      required: step.required !== false,
      timeoutSeconds: step.timeoutSeconds,
    })),
  };
}

export function percent(index: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(99, Math.round((index / total) * 100));
}

export function buildAgentTaskPullSpawnErrorResult(
  step: AgentTaskPullCommandStep,
  startedAt: number,
  error: NodeJS.ErrnoException,
): AgentTaskPullStepResult {
  return {
    key: step.key,
    command: step.command,
    exitCode: null,
    durationMs: Date.now() - startedAt,
    stdout: "",
    stderr: `spawn_error${error.code ? `:${error.code}` : ""}: ${error.message}`,
    timedOut: false,
  };
}

export function buildAgentTaskPullInvalidCwdResult(
  step: AgentTaskPullCommandStep,
  startedAt: number,
  cwd: { baseCwd: string; requestedCwd: string; reason: string },
): AgentTaskPullStepResult {
  return {
    key: step.key,
    command: step.command,
    exitCode: 1,
    durationMs: Date.now() - startedAt,
    stdout: "",
    stderr: `${cwd.reason}: requested ${cwd.requestedCwd} outside ${cwd.baseCwd}`,
    timedOut: false,
  };
}

export function buildAgentTaskPullCancelledResult(
  step: AgentTaskPullCommandStep,
  startedAt: number,
): AgentTaskPullStepResult {
  return {
    key: step.key,
    command: step.command,
    exitCode: null,
    durationMs: Date.now() - startedAt,
    stdout: "",
    stderr: "",
    timedOut: false,
    cancelled: true,
  };
}
