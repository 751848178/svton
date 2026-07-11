import { runAgentTaskPullLoop } from "../utils/agent-task-pull-loop-runner";
import type { AgentHeartbeatClient } from "../utils/agent-heartbeat-types";
import {
  baseLoopConfig,
  createLoopClient,
} from "./agent-task-pull-loop.test-utils";

describe("agent task-pull loop heartbeat", () => {
  it("sends heartbeat before each polling iteration when configured", async () => {
    const client = createLoopClient(["idle", "idle"]);
    const heartbeatCalls: string[] = [];
    const heartbeatClient: AgentHeartbeatClient = {
      async heartbeat(input) {
        heartbeatCalls.push(`${input.agentId}:${input.status}`);
        return { accepted: true };
      },
    };

    const summary = await runAgentTaskPullLoop(
      {
        ...baseLoopConfig({ maxIterations: 2 }),
        heartbeat: heartbeatConfig(),
      },
      {
        client,
        heartbeatClient,
        sleep: async () => undefined,
      },
    );

    expect(summary).toMatchObject({
      iterations: 2,
      executed: 0,
      idle: 2,
      heartbeats: 2,
      stoppedReason: "max_iterations",
    });
    expect(heartbeatCalls).toEqual(["agent-1:ready", "agent-1:ready"]);
  });

  it("returns a structured summary when heartbeat fails before polling", async () => {
    const client = createLoopClient(["task"]);
    const heartbeatClient: AgentHeartbeatClient = {
      async heartbeat() {
        throw new Error("heartbeat denied");
      },
    };

    const summary = await runAgentTaskPullLoop(
      {
        ...baseLoopConfig({ maxIterations: 1 }),
        heartbeat: heartbeatConfig(),
      },
      {
        client,
        heartbeatClient,
      },
    );

    expect(summary).toMatchObject({
      iterations: 0,
      executed: 0,
      idle: 0,
      heartbeats: 0,
      stoppedReason: "heartbeat_failed",
      heartbeatError: "heartbeat denied",
    });
    expect(client.calls).toEqual([]);
  });

  it("returns a structured summary when heartbeat is rejected", async () => {
    const client = createLoopClient(["task"]);
    const heartbeatClient: AgentHeartbeatClient = {
      async heartbeat() {
        return { accepted: false };
      },
    };

    const summary = await runAgentTaskPullLoop(
      {
        ...baseLoopConfig({ maxIterations: 1 }),
        heartbeat: heartbeatConfig(),
      },
      {
        client,
        heartbeatClient,
      },
    );

    expect(summary).toMatchObject({
      iterations: 0,
      executed: 0,
      idle: 0,
      heartbeats: 0,
      stoppedReason: "heartbeat_failed",
      heartbeatError: "heartbeat rejected",
    });
    expect(client.calls).toEqual([]);
  });
});

function heartbeatConfig() {
  return {
    apiUrl: "https://devpilot.example.test",
    token: "heartbeat-token",
    teamId: "team-1",
    serverId: "server-1",
    agentId: "agent-1",
    capabilities: [],
    status: "ready" as const,
  };
}
