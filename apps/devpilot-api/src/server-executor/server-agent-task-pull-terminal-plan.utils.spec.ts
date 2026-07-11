import { buildServerAgentTaskPullTerminalCommandPlan } from "./server-agent-task-pull-terminal-plan.utils";

describe("buildServerAgentTaskPullTerminalCommandPlan", () => {
  it("builds a terminal command plan from the claimed task snapshot", () => {
    const plan = buildServerAgentTaskPullTerminalCommandPlan(
      {
        id: "job-1",
        operationKey: "deployment.deploy",
        adapterKey: "server-agent",
        serverId: "server-1",
        inputSnapshot: {
          operationKey: "deployment.deploy",
          adapterKey: "server-agent",
          dryRun: false,
          target: { transport: "server_agent", serverId: "server-1" },
          steps: [
            {
              key: "deploy",
              label: "Deploy",
              command: "systemctl restart app",
              required: true,
            },
          ],
          metadata: {
            businessRunSync: "deployment",
            secretToken: "should-not-leak",
          },
        },
      },
      {
        teamId: "team-1",
        status: "completed",
        finishedAt: new Date("2026-07-11T00:00:00.000Z"),
      },
    );

    expect(plan).toEqual(
      expect.objectContaining({
        mode: "agent_task_pull_terminal_summary",
        task: expect.objectContaining({
          jobId: "job-1",
          commandSteps: [expect.objectContaining({ key: "deploy" })],
        }),
        terminal: expect.objectContaining({
          status: "completed",
          serverExecutionJobId: "job-1",
        }),
      }),
    );
    expect(JSON.stringify(plan)).not.toContain("secretToken");
    expect(JSON.stringify(plan)).not.toContain("inputSnapshot");
  });

  it("returns undefined when the claimed snapshot is invalid", () => {
    expect(
      buildServerAgentTaskPullTerminalCommandPlan(
        {
          id: "job-1",
          operationKey: "deployment.deploy",
          adapterKey: "server-agent",
          serverId: "server-1",
          inputSnapshot: { metadata: {} },
        },
        {
          teamId: "team-1",
          status: "failed",
          finishedAt: new Date("2026-07-11T00:00:00.000Z"),
        },
      ),
    ).toBeUndefined();
  });
});
