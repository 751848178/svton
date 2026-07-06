import {
  ServerAgentBlockedJobRecord,
  ServerAgentDispatcherConfig,
  ServerAgentFleetJobRecord,
  ServerAgentReadinessRecord,
  ServerAgentRuntimeSummary,
} from "./server-executor-supervisor.types";
import {
  isSupervisorRecord,
  readSupervisorOptionalString,
} from "./server-executor-supervisor-reader.utils";

export function readServerAgentFleetBlockingReasons(
  server: ServerAgentReadinessRecord,
  runtime: ServerAgentRuntimeSummary | undefined,
  heartbeatRequired: boolean,
  dispatcher: ServerAgentDispatcherConfig,
): string[] {
  const reasons = [];
  if (server.status !== "online") {
    reasons.push(`server_${server.status || "unknown"}`);
  }
  if (heartbeatRequired) {
    if (!runtime) {
      reasons.push("missing_heartbeat");
    } else if (runtime.state !== "online") {
      reasons.push(`heartbeat_${runtime.state}`);
    }
  }
  if (!dispatcher.executorEnabled) {
    reasons.push("agent_executor_disabled");
  }
  if (!dispatcher.dispatcherConfigured) {
    reasons.push("dispatcher_not_configured");
  }
  return reasons;
}

export function readServerAgentBlockedJobSummary(
  job: ServerAgentBlockedJobRecord,
): {
  reason: string;
  nextExecutorBoundary?: string;
  dispatcherConfigured?: boolean;
  agentExecutorEnabled?: boolean;
} {
  const result = isSupervisorRecord(job.result) ? job.result : {};
  const nextExecutorBoundary = readSupervisorOptionalString(
    result.nextExecutorBoundary,
  );
  const reason =
    job.error ||
    readSupervisorOptionalString(result.mode) ||
    (nextExecutorBoundary ? `blocked at ${nextExecutorBoundary}` : "unknown");
  const dispatcherConfigured =
    typeof result.dispatcherConfigured === "boolean"
      ? result.dispatcherConfigured
      : undefined;
  const agentExecutorEnabled =
    typeof result.agentExecutorEnabled === "boolean"
      ? result.agentExecutorEnabled
      : undefined;

  return {
    reason,
    ...(nextExecutorBoundary ? { nextExecutorBoundary } : {}),
    ...(dispatcherConfigured !== undefined ? { dispatcherConfigured } : {}),
    ...(agentExecutorEnabled !== undefined ? { agentExecutorEnabled } : {}),
  };
}

export function pickServerAgentNextQueuedJob(
  current: ServerAgentFleetJobRecord | undefined,
  candidate: ServerAgentFleetJobRecord,
): ServerAgentFleetJobRecord {
  if (!current) return candidate;
  if (candidate.priority !== current.priority) {
    return candidate.priority > current.priority ? candidate : current;
  }
  if (candidate.availableAt.getTime() !== current.availableAt.getTime()) {
    return candidate.availableAt < current.availableAt ? candidate : current;
  }
  return candidate.queuedAt < current.queuedAt ? candidate : current;
}

export function serializeServerAgentFleetJob(job: ServerAgentFleetJobRecord) {
  return {
    id: job.id,
    operationKey: job.operationKey,
    adapterKey: job.adapterKey,
    serverId: job.serverId,
    status: job.status,
    priority: job.priority,
    queuedAt: job.queuedAt.toISOString(),
    availableAt: job.availableAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    server: job.server,
  };
}
