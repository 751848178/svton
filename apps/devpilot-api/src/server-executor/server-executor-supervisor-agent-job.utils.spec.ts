import {
  pickServerAgentRunningProgressJob,
  serializeServerAgentFleetJob,
} from "./server-executor-supervisor-agent-job.utils";
import { ServerAgentFleetJobRecord } from "./server-executor-supervisor.types";

describe("server-executor-supervisor-agent-job utils", () => {
  it("serializes a sanitized task-pull progress snapshot", () => {
    const serialized = serializeServerAgentFleetJob(
      buildJob({
        metadata: {
          taskPullProgress: {
            updatedAt: "2026-07-11T05:00:00.000Z",
            agentId: "agent-prod-1",
            runnerId: "runner-prod-1",
            progress: {
              stepKey: "deploy",
              message: "halfway",
              percent: 50,
              rawSecret: "do-not-expose",
            },
          },
        },
      }),
    );

    expect(serialized.taskPullProgress).toEqual({
      updatedAt: "2026-07-11T05:00:00.000Z",
      agentId: "agent-prod-1",
      runnerId: "runner-prod-1",
      stepKey: "deploy",
      message: "halfway",
      percent: 50,
    });
    expect(serialized.taskPullProgress).not.toHaveProperty("rawSecret");
  });

  it("prefers the latest running progress snapshot", () => {
    const older = buildJob({
      id: "job-older",
      metadata: {
        taskPullProgress: {
          updatedAt: "2026-07-11T05:00:00.000Z",
          agentId: "agent-prod-1",
          progress: { message: "older" },
        },
      },
    });
    const newer = buildJob({
      id: "job-newer",
      metadata: {
        taskPullProgress: {
          updatedAt: "2026-07-11T05:01:00.000Z",
          agentId: "agent-prod-1",
          progress: { message: "newer" },
        },
      },
    });

    const picked = pickServerAgentRunningProgressJob(older, newer);

    expect(picked?.id).toBe("job-newer");
  });
});

function buildJob(
  overrides: Partial<ServerAgentFleetJobRecord> = {},
): ServerAgentFleetJobRecord {
  return {
    id: "job-agent-running",
    operationKey: "deployment.run",
    adapterKey: "deployment-plan",
    serverId: "server-1",
    queuedAt: new Date("2026-07-11T04:58:00.000Z"),
    finishedAt: null,
    error: null,
    result: null,
    server: {
      id: "server-1",
      name: "prod",
      host: "10.0.0.1",
      status: "online",
    },
    status: "running",
    queueMode: "queued",
    priority: 10,
    availableAt: new Date("2026-07-11T04:59:00.000Z"),
    lockExpiresAt: new Date("2026-07-11T05:02:00.000Z"),
    metadata: null,
    ...overrides,
  };
}
