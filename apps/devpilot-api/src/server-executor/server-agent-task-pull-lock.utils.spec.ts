import { buildServerAgentTaskPullLockOwner } from "./server-agent-task-pull-lock.utils";

describe("buildServerAgentTaskPullLockOwner", () => {
  it("separates runners for the same agent and server", () => {
    expect(
      buildServerAgentTaskPullLockOwner({
        agentId: "agent-1",
        serverId: "server-1",
        runnerId: "runner-a",
      }),
    ).toBe("server-agent:agent-1:runner-a");
    expect(
      buildServerAgentTaskPullLockOwner({
        agentId: "agent-1",
        serverId: "server-1",
        runnerId: "runner-b",
      }),
    ).toBe("server-agent:agent-1:runner-b");
  });

  it("falls back to the server id when the runner id is absent", () => {
    expect(
      buildServerAgentTaskPullLockOwner({
        agentId: " agent-1 ",
        serverId: "server-1",
        runnerId: " ",
      }),
    ).toBe("server-agent:agent-1:server-1");
  });
});
