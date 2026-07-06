import {
  isRecord,
  readOptionalString,
  readPositiveInteger,
} from "./server-executor-json.utils";
import { ServerRemoteExecutionSession } from "./server-executor.types";

export type ServerExecutionJobAuditScope = {
  projectId: string | null;
  environmentId: string | null;
};

export function readRemoteExecutionSessionSnapshot(
  value: unknown,
): ServerRemoteExecutionSession | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    value.transport !== "ssh" ||
    value.cleanupStrategy !== "best_effort_ssh"
  ) {
    return undefined;
  }

  const pid = readPositiveInteger(value.pid);
  const observedAt = readOptionalString(value.observedAt);
  const operationKey = readOptionalString(value.operationKey);
  const adapterKey = readOptionalString(value.adapterKey);
  if (!pid || !observedAt || !operationKey || !adapterKey) {
    return undefined;
  }

  const serverHost = readOptionalString(value.serverHost);
  const serverId =
    value.serverId === null ? null : readOptionalString(value.serverId);

  return {
    transport: "ssh",
    pid,
    observedAt,
    ...(serverId !== undefined ? { serverId } : {}),
    ...(serverHost ? { serverHost } : {}),
    operationKey,
    adapterKey,
    cleanupStrategy: "best_effort_ssh",
  };
}

export function readServerAgentDispatchCorrelation(
  resultRecord: Record<string, unknown>,
) {
  const correlation = isRecord(resultRecord.correlation)
    ? resultRecord.correlation
    : isRecord(resultRecord.dispatchEnvelope)
      ? isRecord(resultRecord.dispatchEnvelope.correlation)
        ? resultRecord.dispatchEnvelope.correlation
        : {}
      : {};

  return {
    ...(readOptionalString(correlation.serverExecutionJobId)
      ? {
          serverExecutionJobId: readOptionalString(
            correlation.serverExecutionJobId,
          ),
        }
      : {}),
    ...(readOptionalString(correlation.serverExecutionLeaseId)
      ? {
          serverExecutionLeaseId: readOptionalString(
            correlation.serverExecutionLeaseId,
          ),
        }
      : {}),
    ...(readPositiveInteger(correlation.retryAttempt)
      ? { retryAttempt: readPositiveInteger(correlation.retryAttempt) }
      : {}),
    ...(readPositiveInteger(correlation.maxAttempts)
      ? { maxAttempts: readPositiveInteger(correlation.maxAttempts) }
      : {}),
    ...(readOptionalString(correlation.dispatchId)
      ? { dispatchId: readOptionalString(correlation.dispatchId) }
      : {}),
    ...(readOptionalString(correlation.idempotencyKey)
      ? {
          idempotencyKey: readOptionalString(correlation.idempotencyKey),
        }
      : {}),
  };
}

export function readServerAgentDispatcherResponseSummary(value: unknown) {
  const response = isRecord(value) ? value : {};
  const status = readOptionalString(response.status);
  const agentRunId =
    readOptionalString(response.agentRunId) ||
    readOptionalString(response.runId) ||
    readOptionalString(response.executionId) ||
    readOptionalString(response.id);
  const error = readOptionalString(response.error);

  return {
    ...(status ? { status } : {}),
    ...(agentRunId ? { agentRunId } : {}),
    ...(error ? { error } : {}),
  };
}

export function readServerExecutionJobAuditScope(job: {
  inputSnapshot: unknown;
  metadata?: unknown;
}): ServerExecutionJobAuditScope {
  const metadata = isRecord(job.metadata) ? job.metadata : {};
  const inputSnapshot = isRecord(job.inputSnapshot) ? job.inputSnapshot : {};
  const snapshotMetadata = isRecord(inputSnapshot.metadata)
    ? inputSnapshot.metadata
    : {};
  const sourceMetadata = isRecord(metadata.sourceMetadata)
    ? metadata.sourceMetadata
    : isRecord(snapshotMetadata.sourceMetadata)
      ? snapshotMetadata.sourceMetadata
      : snapshotMetadata;

  return {
    projectId:
      readOptionalString(metadata.projectId) ||
      readOptionalString(snapshotMetadata.projectId) ||
      readOptionalString(sourceMetadata.projectId) ||
      null,
    environmentId:
      readOptionalString(metadata.environmentId) ||
      readOptionalString(snapshotMetadata.environmentId) ||
      readOptionalString(sourceMetadata.environmentId) ||
      null,
  };
}
