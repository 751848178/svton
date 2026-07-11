import { Prisma } from "@prisma/client";
import type { ServerAgentTaskPullFinishDto } from "./dto/server-execution-lease.dto";
import { toJsonValue } from "./server-executor-json.utils";

export type ServerAgentTaskPullTerminalOutcome = {
  logs: Prisma.InputJsonValue;
  result: Prisma.InputJsonValue;
};

export function buildServerAgentTaskPullTerminalOutcome(
  dto: ServerAgentTaskPullFinishDto,
  jobId: string,
): ServerAgentTaskPullTerminalOutcome {
  return {
    logs: toJsonValue(dto.logs ?? buildFallbackLogs(dto, jobId)),
    result: toJsonValue(dto.result ?? buildFallbackResult(dto, jobId)),
  };
}

function buildFallbackLogs(dto: ServerAgentTaskPullFinishDto, jobId: string) {
  return [
    {
      level: dto.status === "completed" ? "info" : "warn",
      message: `Server agent task-pull finished with ${dto.status}`,
      serverExecutionJobId: jobId,
      source: "server_agent_task_pull_finish",
    },
  ];
}

function buildFallbackResult(dto: ServerAgentTaskPullFinishDto, jobId: string) {
  return {
    mode: "agent_task_pull_terminal_writeback",
    serverExecutionJobId: jobId,
    status: dto.status,
  };
}
