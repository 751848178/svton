import type {
  AgentTaskPullFinishStatus,
  AgentTaskPullRunSummary,
} from "./agent-task-pull-types";

type AgentTaskPullExecutedRunSummaryInput = {
  jobId: string;
  status: AgentTaskPullFinishStatus;
  stepCount: number;
  error?: string;
  finishSummary?: Pick<
    AgentTaskPullRunSummary,
    "finishAccepted" | "finishFinished" | "finishReason"
  >;
};

export function buildAgentTaskPullExecutedRunSummary(
  input: AgentTaskPullExecutedRunSummaryInput,
): AgentTaskPullRunSummary {
  return {
    mode: "executed",
    jobId: input.jobId,
    status: input.status,
    stepCount: input.stepCount,
    ...(input.error ? { reason: input.error } : {}),
    ...input.finishSummary,
  };
}
