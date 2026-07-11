export const AGENT_TASK_PULL_OUTPUT_LIMIT = 16_000;

export type AgentTaskPullBoundedOutput = {
  value: string;
  truncated: boolean;
};

export function appendAgentTaskPullOutput(
  current: string,
  next: string,
  limit = AGENT_TASK_PULL_OUTPUT_LIMIT,
): AgentTaskPullBoundedOutput {
  const combined = current + next;
  if (combined.length <= limit) {
    return { value: combined, truncated: false };
  }
  return {
    value: combined.slice(combined.length - limit),
    truncated: true,
  };
}
