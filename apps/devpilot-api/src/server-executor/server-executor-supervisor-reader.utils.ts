import { ServerRemoteExecutionSession } from "./server-executor.types";

export function isSupervisorRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readSupervisorOptionalString(
  value: unknown,
): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function readSupervisorOptionalBoolean(
  value: unknown,
): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function readSupervisorPositiveInteger(
  value: unknown,
): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

export function readSupervisorOptionalIsoDate(
  value: unknown,
): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function readSupervisorStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

export function formatSupervisorCountMap<TKey extends string>(
  counts: Map<string, number>,
  key: TKey,
) {
  return [...counts.entries()]
    .map(
      ([value, count]) =>
        ({ [key]: value, count }) as Record<TKey, string> & { count: number },
    )
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left[key].localeCompare(right[key]);
    });
}

export type RemoteExecutionCleanupSummary = {
  attempted: boolean;
  succeeded: boolean;
  failed: boolean;
  reason: string;
  observedAt: string | null;
  error: string | null;
};

export function readRemoteExecutionCleanupSummary(
  value: unknown,
): RemoteExecutionCleanupSummary | null {
  if (!isSupervisorRecord(value)) return null;

  const error = readSupervisorOptionalString(value.error);
  return {
    attempted: value.attempted === true,
    succeeded: value.succeeded === true,
    failed: value.succeeded === false || Boolean(error),
    reason:
      readSupervisorOptionalString(value.reason) || "unknown_remote_cleanup",
    observedAt: readSupervisorOptionalString(value.observedAt) || null,
    error: error ? "cleanup_error_recorded" : null,
  };
}

export function readRemoteExecutionSession(
  value: unknown,
): ServerRemoteExecutionSession | undefined {
  if (!isSupervisorRecord(value)) {
    return undefined;
  }

  if (
    value.transport !== "ssh" ||
    value.cleanupStrategy !== "best_effort_ssh"
  ) {
    return undefined;
  }

  const pid = readSupervisorPositiveInteger(value.pid);
  const observedAt = readSupervisorOptionalString(value.observedAt);
  const operationKey = readSupervisorOptionalString(value.operationKey);
  const adapterKey = readSupervisorOptionalString(value.adapterKey);
  if (!pid || !observedAt || !operationKey || !adapterKey) {
    return undefined;
  }

  const serverHost = readSupervisorOptionalString(value.serverHost);
  const serverId =
    value.serverId === null
      ? null
      : readSupervisorOptionalString(value.serverId);

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

export function summarizeExecutionAuditMetadata(metadata: unknown) {
  const record = isSupervisorRecord(metadata) ? metadata : {};

  const serverExecutionJobId = readSupervisorOptionalString(
    record.serverExecutionJobId,
  );
  const operationKey = readSupervisorOptionalString(record.operationKey);
  const adapterKey = readSupervisorOptionalString(record.adapterKey);
  const transport = readSupervisorOptionalString(record.transport);
  const queueMode = readSupervisorOptionalString(record.queueMode);
  const dryRun = readSupervisorOptionalBoolean(record.dryRun);
  const attempt = readSupervisorPositiveInteger(record.attempt);
  const maxAttempts = readSupervisorPositiveInteger(record.maxAttempts);
  const resultStatus = readSupervisorOptionalString(record.resultStatus);
  const resultMode = readSupervisorOptionalString(record.resultMode);

  return {
    ...(serverExecutionJobId ? { serverExecutionJobId } : {}),
    ...(operationKey ? { operationKey } : {}),
    ...(adapterKey ? { adapterKey } : {}),
    ...(transport ? { transport } : {}),
    ...(queueMode ? { queueMode } : {}),
    ...(dryRun !== undefined ? { dryRun } : {}),
    ...(attempt ? { attempt } : {}),
    ...(maxAttempts ? { maxAttempts } : {}),
    ...(resultStatus ? { resultStatus } : {}),
    ...(resultMode ? { resultMode } : {}),
  };
}
