import { buildServerAgentTaskPullContract } from "./server-agent-task-pull-contract.utils";

function buildContractInput(taskPullEnabled: boolean) {
  return {
    now: new Date("2026-07-11T10:00:00.000Z"),
    server: {
      id: "server-1",
      name: "prod-1",
      host: "10.0.0.1",
      status: "online",
    },
    agentId: "agent-prod-1",
    runnerId: "runner-prod-1",
    requestedCapabilities: ["deploy"],
    agentRef: { agentId: "agent-prod-1" },
    runtime: { state: "online" },
    heartbeatRequired: true,
    taskPullEnabled,
    pollIntervalSeconds: 45,
    readyJobs: 1,
    scheduledJobs: 0,
    runningJobs: 0,
    staleRunningJobs: 0,
    blockedJobs: 0,
    failedJobs: 0,
    cancelledJobs: 0,
    nextQueuedJob: null,
  };
}

describe("buildServerAgentTaskPullContract", () => {
  it("exposes lifecycle envelope discovery when task-pull is enabled", () => {
    const result = buildServerAgentTaskPullContract(buildContractInput(true));

    expect(result.contract).toEqual(
      expect.objectContaining({
        claimedTaskLifecycleEnvelopeSupported: true,
        lifecycleExecutionSupported: false,
        longConnectionSupported: false,
        lifecycleEnvelope: expect.objectContaining({
          version: "server-agent-claimed-task-lifecycle.v0",
          claimResponseField: "task.lifecycle",
          mode: "agent_terminal_command_steps",
          ack: expect.objectContaining({
            endpoint: "/server-agent/task-pull/ack",
            progressWritebackSupported: true,
            cancellationHintSupported: true,
          }),
          finish: expect.objectContaining({
            endpoint: "/server-agent/task-pull/finish",
            statuses: ["completed", "failed", "cancelled"],
            commandPlanFallbackSupported: true,
            terminalOutcomeFallbackSupported: true,
          }),
          boundaries: expect.arrayContaining([
            "agent_executes_command_steps",
            "no_long_connection_runtime",
          ]),
        }),
      }),
    );
    expect(result.readiness.gates.contract).toEqual(
      expect.objectContaining({
        claimedTaskLifecycleEnvelopeSupported: true,
        lifecycleEnvelope: expect.objectContaining({
          claimResponseField: "task.lifecycle",
        }),
        lifecycleExecutionSupported: false,
      }),
    );
  });

  it("keeps lifecycle envelope discovery disabled with task-pull disabled", () => {
    const result = buildServerAgentTaskPullContract(buildContractInput(false));

    expect(result.contract).toEqual(
      expect.objectContaining({
        claimedTaskLifecycleEnvelopeSupported: false,
        lifecycleEnvelope: null,
        lifecycleExecutionSupported: false,
      }),
    );
    expect(result.readiness.gates.contract).toEqual(
      expect.objectContaining({
        claimedTaskLifecycleEnvelopeSupported: false,
        lifecycleEnvelope: null,
      }),
    );
  });
});
