export const TASK_PULL_ACK_ENDPOINT = "/server-agent/task-pull/ack";
export const TASK_PULL_FINISH_ENDPOINT = "/server-agent/task-pull/finish";
export const TASK_PULL_LIFECYCLE_ENVELOPE_VERSION =
  "server-agent-claimed-task-lifecycle.v0";
export const TASK_PULL_LIFECYCLE_MODE = "agent_terminal_command_steps";

const TASK_PULL_LIFECYCLE_BOUNDARIES = [
  "agent_executes_command_steps",
  "ack_renews_running_lock",
  "ack_can_report_progress",
  "ack_returns_cancellation_hint",
  "finish_reports_terminal_outcome",
  "no_server_side_adapter_dispatch",
  "no_long_connection_runtime",
  "no_auto_retry",
] as const;

export function buildServerAgentTaskPullLifecycleDiscovery(enabled: boolean) {
  return {
    claimedTaskLifecycleEnvelopeSupported: enabled,
    lifecycleEnvelope: enabled
      ? {
          version: TASK_PULL_LIFECYCLE_ENVELOPE_VERSION,
          claimResponseField: "task.lifecycle",
          mode: TASK_PULL_LIFECYCLE_MODE,
          ack: {
            endpoint: TASK_PULL_ACK_ENDPOINT,
            required: true,
            progressWritebackSupported: true,
            cancellationHintSupported: true,
          },
          finish: {
            endpoint: TASK_PULL_FINISH_ENDPOINT,
            required: true,
            statuses: ["completed", "failed", "cancelled"] as const,
            commandPlanFallbackSupported: true,
            terminalOutcomeFallbackSupported: true,
          },
          boundaries: TASK_PULL_LIFECYCLE_BOUNDARIES,
        }
      : null,
  };
}
