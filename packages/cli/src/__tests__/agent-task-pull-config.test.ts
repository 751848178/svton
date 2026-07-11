import {
  buildAgentTaskPullConfig,
  buildAgentTaskPullLoopConfig,
} from "../commands/agent-task-pull";

describe("agent task-pull config", () => {
  it("builds once config from options and environment fallback", () => {
    const config = buildAgentTaskPullConfig(
      {
        apiUrl: "https://devpilot.example.test/",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        execute: true,
      },
      {
        DEVPILOT_AGENT_TASK_PULL_TOKEN: "token-1",
        DEVPILOT_AGENT_RUNNER_ID: "runner-1",
        DEVPILOT_AGENT_CAPABILITIES: "deploy, logs",
        DEVPILOT_AGENT_TASK_PULL_ACK_RENEWAL_INTERVAL_MS: "15000",
        DEVPILOT_AGENT_TASK_PULL_FORCE_KILL_GRACE_MS: "2500",
      },
    );

    expect(config).toEqual({
      apiUrl: "https://devpilot.example.test",
      token: "token-1",
      teamId: "team-1",
      serverId: "server-1",
      agentId: "agent-1",
      runnerId: "runner-1",
      capabilities: ["deploy", "logs"],
      execute: true,
      cwd: undefined,
      ackRenewalIntervalMs: 15000,
      forceKillGraceMs: 2500,
    });
  });

  it("uses environment capabilities when commander provides the empty default", () => {
    const config = buildAgentTaskPullConfig(
      {
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        capability: [],
      },
      {
        DEVPILOT_AGENT_CAPABILITIES: "deploy,logs",
      },
    );

    expect(config.capabilities).toEqual(["deploy", "logs"]);
    expect(config.runnerId).toBeUndefined();
  });

  it("requires an explicit loop bound unless forever is enabled", () => {
    expect(() =>
      buildAgentTaskPullLoopConfig({
        apiUrl: "https://devpilot.example.test",
        token: "token-1",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
      }),
    ).toThrow("Missing task-pull loop bound");
  });

  it("builds optional heartbeat config for task-pull run", () => {
    const config = buildAgentTaskPullLoopConfig(
      {
        apiUrl: "https://devpilot.example.test/",
        token: "task-token",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        runner: "runner-1",
        maxIterations: "1",
        ackRenewalIntervalMs: "25000",
        forceKillGraceMs: "3000",
        heartbeatStatus: "ready",
        heartbeatTtlSeconds: "120",
      },
      {
        DEVPILOT_AGENT_HEARTBEAT_TOKEN: "heartbeat-token",
        DEVPILOT_AGENT_HEARTBEAT_HOSTNAME: "agent-host",
        DEVPILOT_AGENT_HEARTBEAT_VERSION: "2.5.8",
        DEVPILOT_AGENT_CAPABILITIES: "deploy,logs",
      },
    );

    expect(config.heartbeat).toEqual({
      apiUrl: "https://devpilot.example.test",
      token: "heartbeat-token",
      teamId: "team-1",
      serverId: "server-1",
      agentId: "agent-1",
      runnerId: "runner-1",
      capabilities: ["deploy", "logs"],
      status: "ready",
      hostname: "agent-host",
      version: "2.5.8",
      ttlSeconds: 120,
    });
    expect(config.ackRenewalIntervalMs).toBe(25000);
    expect(config.forceKillGraceMs).toBe(3000);
  });

  it("generates a default runner id for task-pull run", () => {
    const config = buildAgentTaskPullLoopConfig(
      {
        apiUrl: "https://devpilot.example.test/",
        token: "task-token",
        team: "team-1",
        server: "server-1",
        agent: "agent-1",
        maxIterations: "1",
      },
      {
        HOSTNAME: "agent host",
        DEVPILOT_AGENT_HEARTBEAT_TOKEN: "heartbeat-token",
      },
    );

    expect(config.runnerId).toBe(`cli-agent-host-${process.pid}`);
    expect(config.heartbeat?.runnerId).toBe(config.runnerId);
  });
});
