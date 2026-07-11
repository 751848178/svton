import type {
  AgentTaskPullFinishStatus,
  AgentTaskPullTask,
} from "./agent-task-pull-types";
import type { AgentTaskPullStepResult } from "./agent-task-pull-executor";

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
