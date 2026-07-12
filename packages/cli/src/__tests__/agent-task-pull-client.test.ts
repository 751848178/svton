import { HttpAgentTaskPullClient } from "../utils/agent-task-pull-client";

describe("HttpAgentTaskPullClient", () => {
  it("unwraps Devpilot API response envelopes", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: "success",
        data: {
          contract: {
            claimedTaskLifecycleEnvelopeSupported: true,
            lifecycleEnvelope: { claimResponseField: "task.lifecycle" },
          },
        },
      }),
    });
    const client = new HttpAgentTaskPullClient(
      { apiUrl: "http://devpilot.test/api", token: "task-token" },
      fetchImpl as unknown as typeof fetch,
    );

    await expect(
      client.contract({
        teamId: "team-1",
        serverId: "server-1",
        agentId: "agent-1",
        capabilities: [],
      }),
    ).resolves.toEqual({
      contract: {
        claimedTaskLifecycleEnvelopeSupported: true,
        lifecycleEnvelope: { claimResponseField: "task.lifecycle" },
      },
    });
  });
});
