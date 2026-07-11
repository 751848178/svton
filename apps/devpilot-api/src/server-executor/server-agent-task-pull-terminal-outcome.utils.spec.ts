import { buildServerAgentTaskPullTerminalOutcome } from "./server-agent-task-pull-terminal-outcome.utils";

describe("buildServerAgentTaskPullTerminalOutcome", () => {
  it("builds fallback logs and result when finish omits them", () => {
    const outcome = buildServerAgentTaskPullTerminalOutcome(
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-1",
        jobId: "job-1",
        status: "completed",
      },
      "job-1",
    );

    expect(outcome).toEqual({
      logs: [
        expect.objectContaining({
          level: "info",
          serverExecutionJobId: "job-1",
        }),
      ],
      result: {
        mode: "agent_task_pull_terminal_writeback",
        serverExecutionJobId: "job-1",
        status: "completed",
      },
    });
  });

  it("preserves agent-supplied terminal logs and result", () => {
    const outcome = buildServerAgentTaskPullTerminalOutcome(
      {
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-1",
        jobId: "job-1",
        status: "failed",
        logs: [{ level: "error", message: "boom" }],
        result: { exitCode: 1 },
      },
      "job-1",
    );

    expect(outcome).toEqual({
      logs: [{ level: "error", message: "boom" }],
      result: { exitCode: 1 },
    });
  });
});
