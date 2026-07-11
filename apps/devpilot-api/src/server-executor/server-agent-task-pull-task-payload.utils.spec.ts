import { buildServerAgentClaimedTaskPayload } from "./server-agent-task-pull-task-payload.utils";

describe("buildServerAgentClaimedTaskPayload", () => {
  it("builds a sanitized task payload from a claimed job snapshot", () => {
    const payload = buildServerAgentClaimedTaskPayload(
      {
        id: "job-1",
        operationKey: "deployment.deploy",
        adapterKey: "server-agent",
        serverId: "server-1",
        inputSnapshot: {
          operationKey: "deployment.deploy",
          adapterKey: "server-agent",
          dryRun: false,
          target: {
            transport: "server_agent",
            serverId: "server-1",
            serverHost: "10.0.0.1",
            credentialRef: {
              source: "server",
              referenceId: "cred-1",
              displayName: "prod ssh",
              redacted: true,
            },
          },
          steps: [
            {
              key: "deploy",
              label: "Deploy app",
              command: "systemctl restart app",
              required: true,
              risk: "medium",
              timeoutSeconds: 60,
            },
          ],
          warnings: ["requires approval"],
          metadata: {
            businessRunSync: "deployment",
            serverExecutionLeaseId: "lease-1",
            secretToken: "should-not-leak",
            commandPolicy: { mode: "internal-only" },
          },
        },
      },
      { teamId: "team-1" },
    );

    expect(payload).toEqual(
      expect.objectContaining({
        available: true,
        jobId: "job-1",
        operationKey: "deployment.deploy",
        commandSteps: [
          expect.objectContaining({
            key: "deploy",
            command: "systemctl restart app",
          }),
        ],
        lifecycle: {
          mode: "agent_terminal_command_steps",
          serverExecutionJobId: "job-1",
          ack: {
            endpoint: "/server-agent/task-pull/ack",
            required: true,
            progressWritebackSupported: true,
            cancellationHintSupported: true,
          },
          finish: {
            endpoint: "/server-agent/task-pull/finish",
            required: true,
            statuses: ["completed", "failed", "cancelled"],
            commandPlanFallbackSupported: true,
            terminalOutcomeFallbackSupported: true,
          },
          boundaries: expect.arrayContaining([
            "agent_executes_command_steps",
            "ack_can_report_progress",
            "finish_reports_terminal_outcome",
            "no_server_side_adapter_dispatch",
          ]),
        },
        metadata: { businessRunSync: "deployment" },
        correlation: expect.objectContaining({
          serverExecutionJobId: "job-1",
          serverExecutionLeaseId: "lease-1",
        }),
      }),
    );
    expect(JSON.stringify(payload)).not.toContain("secretToken");
    expect(JSON.stringify(payload)).not.toContain("commandPolicy");
    expect(payload).not.toHaveProperty("inputSnapshot");
  });

  it("returns an unavailable payload for invalid snapshots", () => {
    const payload = buildServerAgentClaimedTaskPayload(
      {
        id: "job-1",
        operationKey: "deployment.deploy",
        adapterKey: "server-agent",
        serverId: "server-1",
        inputSnapshot: { metadata: {} },
      },
      { teamId: "team-1" },
    );

    expect(payload).toEqual(
      expect.objectContaining({
        available: false,
        reason: "invalid_input_snapshot",
        commandSteps: [],
      }),
    );
  });
});
