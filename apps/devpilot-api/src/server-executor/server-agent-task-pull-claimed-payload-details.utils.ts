import {
  TASK_PULL_ACK_ENDPOINT,
  TASK_PULL_FINISH_ENDPOINT,
  TASK_PULL_LIFECYCLE_MODE,
} from "./server-agent-task-pull-lifecycle-discovery.utils";
import {
  isRecord,
  readOptionalString,
  readPositiveInteger,
} from "./server-executor-json.utils";
import type {
  ServerCommandStep,
  ServerExecutionInput,
  ServerExecutorTarget,
} from "./server-executor.types";
import type { ServerAgentClaimedTaskJob } from "./server-agent-task-pull-task-payload.utils";

export function buildServerAgentTaskPullRedactedTarget(
  target: ServerExecutorTarget,
) {
  return {
    transport: target.transport,
    serverId: target.serverId || null,
    serverName: target.serverName,
    serverHost: target.serverHost,
    port: target.port,
    username: target.username,
    authType: target.authType,
    ...(target.agentRef
      ? { agentRef: { ...target.agentRef, redacted: true as const } }
      : {}),
    ...(target.credentialRef
      ? { credentialRef: { ...target.credentialRef, redacted: true as const } }
      : {}),
  };
}

export function buildServerAgentTaskPullCommandStepPayload(
  step: ServerCommandStep,
) {
  return {
    key: step.key,
    label: step.label,
    command: step.command,
    cwd: step.cwd,
    required: step.required,
    risk: step.risk,
    timeoutSeconds: step.timeoutSeconds,
    preview: step.preview,
  };
}

export function buildServerAgentTaskPullLifecycleEnvelope(
  job: ServerAgentClaimedTaskJob,
) {
  return {
    mode: TASK_PULL_LIFECYCLE_MODE,
    serverExecutionJobId: job.id,
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
    boundaries: [
      "agent_executes_command_steps",
      "ack_renews_running_lock",
      "ack_can_report_progress",
      "ack_returns_cancellation_hint",
      "finish_reports_terminal_outcome",
      "no_server_side_adapter_dispatch",
      "no_long_connection_runtime",
      "no_auto_retry",
    ],
  };
}

export function buildServerAgentTaskPullCorrelation(
  job: ServerAgentClaimedTaskJob,
  input: ServerExecutionInput,
  teamId: string,
) {
  const metadata = isRecord(input.metadata) ? input.metadata : {};
  return {
    serverExecutionJobId: job.id,
    idempotencyKey: `server-agent-task:${teamId}:${job.id}`,
    ...(readOptionalString(metadata.serverExecutionLeaseId)
      ? {
          serverExecutionLeaseId: readOptionalString(
            metadata.serverExecutionLeaseId,
          ),
        }
      : {}),
    ...(readOptionalString(metadata.retryOfJobId)
      ? { retryOfJobId: readOptionalString(metadata.retryOfJobId) }
      : {}),
    ...(readPositiveInteger(metadata.retryAttempt)
      ? { retryAttempt: readPositiveInteger(metadata.retryAttempt) }
      : {}),
    ...(readPositiveInteger(metadata.maxAttempts)
      ? { maxAttempts: readPositiveInteger(metadata.maxAttempts) }
      : {}),
  };
}

export function buildServerAgentTaskPullSafeMetadata(
  input: ServerExecutionInput,
) {
  const metadata = isRecord(input.metadata) ? input.metadata : {};
  const keys = [
    "businessRunSync",
    "logCollectionRunId",
    "logStreamId",
    "sourceType",
    "sourceKey",
  ];

  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = readOptionalString(metadata[key]);
      return value ? [[key, value]] : [];
    }),
  );
}
