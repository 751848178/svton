export const SERVER_AGENT_TASK_PULL_ACK_ENDPOINT =
  "/server-agent/task-pull/ack";

export function buildServerAgentTaskPullNoAckResult(reason: string) {
  return {
    accepted: true,
    acked: false,
    reason,
    endpoint: SERVER_AGENT_TASK_PULL_ACK_ENDPOINT,
    job: null,
  };
}

export function buildServerAgentTaskPullAckMetadata(
  lockOwner: string,
  lockExpiresAt: Date,
) {
  return {
    mode: "ack_only",
    taskPullEnabled: true,
    ackSupported: true,
    cancellationHintSupported: true,
    progressWritebackSupported: true,
    lifecycleExecutionSupported: false,
    terminalWritebackSupported: true,
    lockOwner,
    lockExpiresAt: lockExpiresAt.toISOString(),
    boundaries: [
      "ack_only",
      "cancellation_hint_only",
      "progress_writeback_only",
      "finish_supported",
      "no_adapter_execution",
    ],
  };
}

export function buildServerAgentTaskPullCancellationHint(job: {
  id: string;
  cancelRequestedAt: Date | null;
  error: string | null;
}) {
  if (!job.cancelRequestedAt) return null;

  return {
    requested: true,
    shouldStop: true,
    requestedAt: job.cancelRequestedAt.toISOString(),
    finishStatus: "cancelled",
    reason: job.error || "server_execution_job_cancel_requested",
    serverExecutionJobId: job.id,
  };
}
