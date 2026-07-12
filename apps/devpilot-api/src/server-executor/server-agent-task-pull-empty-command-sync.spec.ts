import type { Prisma } from "@prisma/client";
import { LogCollectionIngestionService } from "../log-center/log-collection-ingestion.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  ServerAgentTaskPullFinishSyncJob,
  ServerAgentTaskPullFinishSyncService,
} from "./server-agent-task-pull-finish-sync.service";

describe("ServerAgentTaskPullFinishSyncService empty command snapshots", () => {
  it("syncs deployment runs when optional command steps are empty", async () => {
    const prisma = {
      deploymentRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      operationApproval: {
        updateMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const ingestionService = {
      ingestCompletedRun: jest.fn(),
    } as unknown as LogCollectionIngestionService;
    const service = new ServerAgentTaskPullFinishSyncService(
      prisma,
      ingestionService,
    );

    const result = await service.syncAfterFinish(
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-1",
        jobId: "job-1",
        status: "completed",
        logs: [{ level: "info", message: "agent deployed" }],
        result: { releaseId: "release-1" },
      },
      buildDeploymentJob(),
    );

    expect(prisma.deploymentRun.updateMany).toHaveBeenCalledWith({
      where: { id: "deploy-run-1", teamId: "team-1" },
      data: expect.objectContaining({
        serverExecutionJobId: "job-1",
        status: "completed",
        result: { releaseId: "release-1" },
      }),
    });
    expect(result).toEqual({
      businessRunSync: "deployment",
      synced: true,
    });
  });
});

function buildDeploymentJob(): ServerAgentTaskPullFinishSyncJob {
  return {
    id: "job-1",
    teamId: "team-1",
    actorId: "user-1",
    retryOfId: null,
    attempt: 1,
    maxAttempts: 1,
    adapterKey: "deployment-script-plan",
    inputSnapshot: {
      operationKey: "deployment.run",
      adapterKey: "deployment-script-plan",
      dryRun: true,
      target: { transport: "server_agent", serverId: "server-1" },
      steps: [
        {
          key: "checkout",
          label: "Checkout",
          command: "git pull",
          required: true,
        },
        {
          key: "build",
          label: "Build",
          command: "",
          required: false,
        },
      ],
      metadata: {
        businessRunSync: "deployment",
        deploymentRunId: "deploy-run-1",
      },
    } as Prisma.JsonObject,
  };
}
