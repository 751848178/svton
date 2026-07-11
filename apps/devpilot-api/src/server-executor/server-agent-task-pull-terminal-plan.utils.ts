import { Prisma } from "@prisma/client";
import { toJsonValue } from "./server-executor-json.utils";
import { buildServerAgentClaimedTaskPayload } from "./server-agent-task-pull-task-payload.utils";

export type ServerAgentTaskPullTerminalStatus =
  | "completed"
  | "failed"
  | "cancelled";

export type ServerAgentTaskPullTerminalPlanJob = {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId: string | null;
  inputSnapshot: Prisma.JsonValue;
};

export function buildServerAgentTaskPullTerminalCommandPlan(
  job: ServerAgentTaskPullTerminalPlanJob,
  options: {
    teamId: string;
    status: ServerAgentTaskPullTerminalStatus;
    finishedAt: Date;
  },
): Prisma.InputJsonValue | undefined {
  const task = buildServerAgentClaimedTaskPayload(job, {
    teamId: options.teamId,
  });
  if (!task.available) return undefined;

  return toJsonValue({
    version: "server-agent-task-pull-terminal-plan.v0",
    mode: "agent_task_pull_terminal_summary",
    task,
    terminal: {
      status: options.status,
      finishedAt: options.finishedAt.toISOString(),
      serverExecutionJobId: job.id,
    },
    boundaries: [
      "derived_from_claimed_task_payload",
      "no_raw_input_snapshot",
      "no_server_side_adapter_dispatch",
      "no_long_connection_runtime",
      "no_auto_retry",
    ],
  });
}
