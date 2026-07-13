import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { ServerExecutionResult } from "./server-executor.types";
import { isRecord, toJsonValue } from "./server-executor-json.utils";
import type { ServerAgentClaimedTaskJob } from "./server-agent-task-pull-task-payload.utils";

export async function blockServerAgentTaskPullJobForPolicy(
  prisma: PrismaService,
  job: ServerAgentClaimedTaskJob,
  lockOwner: string,
  result: ServerExecutionResult,
  now: Date,
) {
  const blocked = await prisma.serverExecutionJob.updateMany({
    where: {
      id: job.id,
      teamId: job.teamId,
      serverId: job.serverId,
      transport: "server_agent",
      status: "running",
      lockOwner,
    },
    data: {
      status: "blocked",
      commandPlan: result.commandPlan as Prisma.InputJsonValue,
      logs: result.logs as Prisma.InputJsonValue,
      result: result.result as Prisma.InputJsonValue,
      error: result.error,
      lockedAt: null,
      lockOwner: null,
      lockExpiresAt: null,
      lastHeartbeatAt: null,
      finishedAt: now,
      metadata: toJsonValue({
        ...(isRecord(job.metadata) ? job.metadata : {}),
        taskPullClaimBlockedByCommandPolicy: true,
      }),
    },
  });
  return blocked.count > 0;
}
