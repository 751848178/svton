import { buildAgentTaskPullConfig } from "../commands/agent-task-pull";

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
});
