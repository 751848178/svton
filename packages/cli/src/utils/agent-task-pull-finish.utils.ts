import type {
  AgentTaskPullFinishPayload,
  AgentTaskPullFinishResponse,
  AgentTaskPullHttpClient,
  AgentTaskPullIdentity,
  AgentTaskPullRunSummary,
  AgentTaskPullTask,
} from "./agent-task-pull-types";
import { buildAgentTaskPullCommandPlan } from "./agent-task-pull-result.utils";
import { buildAgentTaskPullExecutedRunSummary } from "./agent-task-pull-summary.utils";

type AgentTaskPullExecutionFinish = {
  status: AgentTaskPullFinishPayload["status"];
  logs?: unknown;
  result?: unknown;
  error?: string;
};

export function buildAgentTaskPullFinishPayload(
  task: AgentTaskPullTask,
  executed: AgentTaskPullExecutionFinish,
): AgentTaskPullFinishPayload {
  return {
    status: executed.status,
    commandPlan: buildAgentTaskPullCommandPlan(task),
    logs: executed.logs,
    result: executed.result,
    ...(executed.error ? { error: executed.error } : {}),
  };
}

export function finishAgentTaskPullExecution(
  client: AgentTaskPullHttpClient,
  identity: AgentTaskPullIdentity,
  task: AgentTaskPullTask,
  executed: AgentTaskPullExecutionFinish,
) {
  return client
    .finish(
      identity,
      task.jobId,
      buildAgentTaskPullFinishPayload(task, executed),
    )
    .then((response) =>
      buildAgentTaskPullExecutedRunSummary({
        jobId: task.jobId,
        status: executed.status,
        stepCount: task.commandSteps.length,
        error: executed.error,
        finishSummary: readAgentTaskPullFinishWritebackSummary(response),
      }),
    );
}

export function readAgentTaskPullFinishWritebackSummary(
  response: AgentTaskPullFinishResponse,
): Pick<
  AgentTaskPullRunSummary,
  "finishAccepted" | "finishFinished" | "finishReason"
> {
  if (response.accepted !== false && response.finished !== false) return {};
  return {
    ...(typeof response.accepted === "boolean"
      ? { finishAccepted: response.accepted }
      : {}),
    ...(typeof response.finished === "boolean"
      ? { finishFinished: response.finished }
      : {}),
    ...(response.reason ? { finishReason: response.reason } : {}),
  };
}
