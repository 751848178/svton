import {
  buildAgentTaskPullRunRuntimeProfile,
  buildAgentTaskPullStartupFailureLoopSummary,
  withAgentTaskPullLoopRunnerId,
  withAgentTaskPullRunRuntimeProfile,
} from "../commands/agent-task-pull-command-result.service";
import type { AgentTaskPullLoopConfig } from "../utils/agent-task-pull-loop-runner";
import type { AgentTaskPullLoopSummary } from "../utils/agent-task-pull-loop-summary.types";

describe("agent task-pull command result service", () => {
  it("builds a startup failure loop summary with runner context", () => {
    expect(
      buildAgentTaskPullStartupFailureLoopSummary({
        startupError: "pid file is busy",
        runnerId: "runner-1",
      }),
    ).toEqual({
      mode: "loop",
      iterations: 0,
      executed: 0,
      idle: 0,
      heartbeats: 0,
      stoppedReason: "startup_failed",
      startupError: "pid file is busy",
      runnerId: "runner-1",
      runs: [],
    });
  });

  it("omits optional startup failure fields when they are absent", () => {
    expect(buildAgentTaskPullStartupFailureLoopSummary({})).toEqual({
      mode: "loop",
      iterations: 0,
      executed: 0,
      idle: 0,
      heartbeats: 0,
      stoppedReason: "startup_failed",
      runs: [],
    });
  });

  it("adds runner id to a loop summary when configured", () => {
    const summary = buildLoopSummary();

    expect(withAgentTaskPullLoopRunnerId(summary, "runner-1")).toEqual({
      ...summary,
      runnerId: "runner-1",
    });
  });

  it("returns the original loop summary when runner id is absent", () => {
    const summary = buildLoopSummary();

    expect(withAgentTaskPullLoopRunnerId(summary)).toBe(summary);
  });

  it("builds a non-sensitive run runtime profile", () => {
    expect(
      buildAgentTaskPullRunRuntimeProfile(buildLoopConfig(), {
        forever: true,
        pidFile: "/tmp/devpilot-agent.pid",
      }),
    ).toEqual({
      processId: process.pid,
      runnerId: "runner-1",
      pidFileConfigured: true,
      pidFile: "/tmp/devpilot-agent.pid",
      heartbeatConfigured: true,
      heartbeatStatus: "ready",
      heartbeatTtlSeconds: 120,
      loop: {
        intervalMs: 5000,
        forever: true,
        idleLimit: 3,
      },
      ackRenewalIntervalMs: 25000,
      forceKillGraceMs: 3000,
    });
  });

  it("adds a runtime profile to loop summaries", () => {
    const summary = buildLoopSummary();
    const runtimeProfile =
      buildAgentTaskPullRunRuntimeProfile(buildLoopConfig());

    expect(withAgentTaskPullRunRuntimeProfile(summary, runtimeProfile)).toEqual(
      {
        ...summary,
        runtimeProfile,
      },
    );
  });
});

function buildLoopSummary(): AgentTaskPullLoopSummary {
  return {
    mode: "loop",
    iterations: 1,
    executed: 1,
    idle: 0,
    heartbeats: 0,
    stoppedReason: "max_iterations",
    runs: [],
  };
}

function buildLoopConfig(): AgentTaskPullLoopConfig {
  return {
    apiUrl: "https://devpilot.example.test",
    token: "secret-task-token",
    teamId: "team-1",
    serverId: "server-1",
    agentId: "agent-1",
    runnerId: "runner-1",
    capabilities: ["deploy"],
    execute: true,
    intervalMs: 5000,
    idleLimit: 3,
    heartbeat: {
      apiUrl: "https://devpilot.example.test",
      token: "secret-heartbeat-token",
      teamId: "team-1",
      serverId: "server-1",
      agentId: "agent-1",
      runnerId: "runner-1",
      capabilities: ["deploy"],
      status: "ready",
      ttlSeconds: 120,
    },
    ackRenewalIntervalMs: 25000,
    forceKillGraceMs: 3000,
  };
}
