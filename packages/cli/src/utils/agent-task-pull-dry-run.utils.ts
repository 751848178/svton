import type { AgentTaskPullStepResult } from "./agent-task-pull-executor";
import type { AgentTaskPullTask } from "./agent-task-pull-types";

export function buildAgentTaskPullDryRunResults(
  task: AgentTaskPullTask,
): AgentTaskPullStepResult[] {
  return task.commandSteps.map((step) => ({
    key: step.key,
    command: step.command,
    exitCode: 0,
    durationMs: 0,
    stdout: "",
    stderr: "",
    timedOut: false,
    dryRunSkipped: true,
  }));
}
