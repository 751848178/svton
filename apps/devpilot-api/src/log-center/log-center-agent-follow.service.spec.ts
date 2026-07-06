import { ServerExecutorService } from "../server-executor/server-executor.service";
import { AliyunSlsLogQueryAdapter } from "./aliyun-sls-log-query.adapter";
import { LogCenterAuditService } from "./log-center-audit.service";
import { LogCollectionRunExecutionService } from "./log-collection-run-execution.service";
import { LogCollectionIngestionService } from "./log-collection-ingestion.service";
import { LogProviderCollectionPlanService } from "./log-provider-collection-plan.service";
import { LogServerCollectionExecutionService } from "./log-server-collection-execution.service";

type CollectionPlanStream = Parameters<
  LogCollectionRunExecutionService["executeCollectionPlan"]
>[2];

describe("LogCollectionRunExecutionService agent follow collection plans", () => {
  let serverExecutorService: {
    resolveTarget: jest.Mock;
    queueExecution: jest.Mock;
    execute: jest.Mock;
  };
  let service: LogCollectionRunExecutionService;

  beforeEach(() => {
    serverExecutorService = {
      resolveTarget: jest.fn(),
      queueExecution: jest.fn(),
      execute: jest.fn(),
    };
    service = new LogCollectionRunExecutionService(
      {} as never,
      {} as unknown as LogCollectionIngestionService,
      {} as LogCenterAuditService,
      new LogServerCollectionExecutionService(
        serverExecutorService as unknown as ServerExecutorService,
      ),
      new LogProviderCollectionPlanService({} as AliyunSlsLogQueryAdapter),
    );
  });

  it("queues agent follow only when the resolved target is server_agent", async () => {
    serverExecutorService.resolveTarget.mockResolvedValue(serverAgentTarget());
    serverExecutorService.queueExecution.mockResolvedValue({
      status: "queued",
      executorKey: "server-executor",
      adapterKey: "log-collection-plan",
      serverExecutionJobId: "job-1",
      commandPlan: { mode: "queued" },
      logs: [],
      result: { queued: true },
    });

    const result = await service.executeCollectionPlan(
      "team-1",
      null,
      logStream(),
      "collection-run-agent-1",
      agentFollowOptions(),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "queued",
        serverExecutionJobId: "job-1",
      }),
    );
    expect(serverExecutorService.queueExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ transport: "server_agent" }),
        metadata: expect.objectContaining({
          businessRunSync: "log_collection",
          params: expect.objectContaining({
            scheduledAgentFollow: true,
            requiredTransport: "server_agent",
          }),
        }),
      }),
      { maxAttempts: 2 },
    );
  });

  it("blocks agent follow instead of falling back to ssh", async () => {
    serverExecutorService.resolveTarget.mockResolvedValue({
      ...serverAgentTarget(),
      transport: "ssh",
    });

    const result = await service.executeCollectionPlan(
      "team-1",
      null,
      logStream(),
      "collection-run-agent-2",
      agentFollowOptions(),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "blocked",
        executorKey: "server-executor",
        adapterKey: "log-collection-plan",
        error: expect.stringContaining("server_agent"),
      }),
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        mode: "blocked_agent_follow",
        requiredTransport: "server_agent",
        resolvedTransport: "ssh",
      }),
    );
    expect(serverExecutorService.queueExecution).not.toHaveBeenCalled();
    expect(serverExecutorService.execute).not.toHaveBeenCalled();
  });
});

function agentFollowOptions() {
  return {
    dryRun: false,
    tail: 120,
    queue: true,
    maxAttempts: 2,
    params: {
      scheduledAgentFollow: true,
      followMode: "agent",
      requiredTransport: "server_agent",
    },
  };
}

function serverAgentTarget() {
  return {
    transport: "server_agent",
    serverId: "server-1",
    serverName: "prod-1",
    serverHost: "10.0.0.1",
  };
}

function logStream(): CollectionPlanStream {
  return {
    id: "stream-1",
    serverId: "server-1",
    sourceType: "docker",
    sourceKey: "api",
    applicationService: null,
    managedResource: null,
  } as unknown as CollectionPlanStream;
}
