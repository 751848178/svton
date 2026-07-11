import { Prisma } from "@prisma/client";
import { rehydrateServerExecutionInput } from "./server-executor-input-snapshot.utils";
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
import {
  TASK_PULL_ACK_ENDPOINT,
  TASK_PULL_FINISH_ENDPOINT,
  TASK_PULL_LIFECYCLE_MODE,
} from "./server-agent-task-pull-lifecycle-discovery.utils";

export type ServerAgentClaimedTaskJob = {
  id: string;
  operationKey: string;
  adapterKey: string;
  serverId: string | null;
  inputSnapshot: Prisma.JsonValue;
};

export function buildServerAgentClaimedTaskPayload(
  job: ServerAgentClaimedTaskJob,
  options: { teamId: string },
) {
  const input = readTaskInput(job, options.teamId);
  if (!input) {
    return {
      available: false,
      version: "server-agent-claimed-task.v0",
      reason: "invalid_input_snapshot",
      jobId: job.id,
      operationKey: job.operationKey,
      adapterKey: job.adapterKey,
      serverId: job.serverId,
      stepCount: 0,
      commandSteps: [],
    };
  }

  const metadata = buildSafeMetadata(input);
  return {
    available: true,
    version: "server-agent-claimed-task.v0",
    jobId: job.id,
    operationKey: input.operationKey,
    adapterKey: input.adapterKey,
    dryRun: input.dryRun,
    target: buildRedactedTarget(input.target),
    stepCount: input.steps.length,
    commandSteps: input.steps.map(buildCommandStepPayload),
    lifecycle: buildLifecycleEnvelope(job),
    warnings: input.warnings || [],
    correlation: buildCorrelation(job, input, options.teamId),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}

function readTaskInput(
  job: ServerAgentClaimedTaskJob,
  teamId: string,
): ServerExecutionInput | null {
  try {
    return rehydrateServerExecutionInput(job.inputSnapshot, { teamId });
  } catch {
    return null;
  }
}

function buildRedactedTarget(target: ServerExecutorTarget) {
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

function buildCommandStepPayload(step: ServerCommandStep) {
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

function buildLifecycleEnvelope(job: ServerAgentClaimedTaskJob) {
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

function buildCorrelation(
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

function buildSafeMetadata(input: ServerExecutionInput) {
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
