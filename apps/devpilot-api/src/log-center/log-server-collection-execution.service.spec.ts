import { ServerExecutorService } from "../server-executor/server-executor.service";
import { LogServerCollectionExecutionService } from "./log-server-collection-execution.service";

describe("LogServerCollectionExecutionService", () => {
  let serverExecutorService: {
    resolveTarget: jest.Mock;
    queueExecution: jest.Mock;
    execute: jest.Mock;
  };
  let service: LogServerCollectionExecutionService;

  beforeEach(() => {
    serverExecutorService = {
      resolveTarget: jest.fn(),
      queueExecution: jest.fn(),
      execute: jest.fn(),
    };
    service = new LogServerCollectionExecutionService(
      serverExecutorService as unknown as ServerExecutorService,
    );
  });

  it("blocks agent follow when target resolution does not select server_agent", async () => {
    serverExecutorService.resolveTarget.mockResolvedValue({
      serverId: "server-1",
      transport: "ssh",
    });

    const result = await service.execute(
      "team-1",
      null,
      stream(),
      "run-1",
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
    expect(serverExecutorService.queueExecution).not.toHaveBeenCalled();
    expect(serverExecutorService.execute).not.toHaveBeenCalled();
  });

  it("normalizes queued server executor results", async () => {
    serverExecutorService.resolveTarget.mockResolvedValue({
      serverId: "server-1",
      transport: "server_agent",
    });
    serverExecutorService.queueExecution.mockResolvedValue({
      status: "queued",
      executorKey: "server-executor",
      adapterKey: "log-collection-plan",
      serverExecutionJobId: "job-1",
      commandPlan: { mode: "queued" },
      logs: [],
      result: { queued: true },
    });

    const result = await service.execute(
      "team-1",
      "user-1",
      stream(),
      "run-2",
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
        teamId: "team-1",
        userId: "user-1",
        target: expect.objectContaining({ transport: "server_agent" }),
        metadata: expect.objectContaining({
          businessRunSync: "log_collection",
          logCollectionRunId: "run-2",
          logStreamId: "stream-1",
        }),
      }),
      { maxAttempts: 2 },
    );
  });
});

function agentFollowOptions() {
  return {
    dryRun: false,
    tail: 50,
    queue: true,
    maxAttempts: 2,
    params: {
      scheduledAgentFollow: true,
      requiredTransport: "server_agent",
    },
  };
}

function stream() {
  return {
    id: "stream-1",
    sourceType: "nginx",
    sourceKey: "/var/log/nginx/access.log",
    serverId: "server-1",
  };
}
