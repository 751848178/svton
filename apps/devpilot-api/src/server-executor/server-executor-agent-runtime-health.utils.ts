import {
  ServerAgentRuntimeHealthState,
  ServerAgentRuntimeHealthSummary,
  ServerAgentRuntimeSummary,
} from "./server-executor-supervisor.types";

export function readServerAgentRuntimeHealth(
  runtime: ServerAgentRuntimeSummary | undefined,
  now: Date,
  defaultHeartbeatTtlSeconds: number,
): ServerAgentRuntimeHealthSummary {
  if (!runtime) {
    return {
      state: "missing",
      reason: "heartbeat_missing",
      expiringSoon: false,
      capabilities: [],
    };
  }

  const lastSeenAtMs = runtime.lastSeenAt
    ? Date.parse(runtime.lastSeenAt)
    : Number.NaN;
  const expiresAtMs = runtime.expiresAt
    ? Date.parse(runtime.expiresAt)
    : Number.NaN;
  const lastSeenAgeSeconds = Number.isFinite(lastSeenAtMs)
    ? Math.max(0, Math.round((now.getTime() - lastSeenAtMs) / 1000))
    : undefined;
  const expiresInSeconds = Number.isFinite(expiresAtMs)
    ? Math.round((expiresAtMs - now.getTime()) / 1000)
    : undefined;
  const heartbeatTtlSeconds =
    runtime.heartbeatTtlSeconds || defaultHeartbeatTtlSeconds;
  const expiringSoonThresholdSeconds = Math.max(
    30,
    Math.round(heartbeatTtlSeconds * 0.25),
  );
  const expiringSoon =
    runtime.state === "online" &&
    expiresInSeconds !== undefined &&
    expiresInSeconds >= 0 &&
    expiresInSeconds <= expiringSoonThresholdSeconds;

  let state: ServerAgentRuntimeHealthState = "ready";
  let reason = "runtime_online";
  if (runtime.state === "stale") {
    state = "stale";
    reason = "heartbeat_expired";
  } else if (runtime.state === "unknown") {
    state = "unknown";
    reason = "heartbeat_expiry_unknown";
  } else if (runtime.status === "degraded") {
    state = "degraded";
    reason = "agent_status_degraded";
  } else if (expiringSoon) {
    state = "degraded";
    reason = "heartbeat_expiring_soon";
  }

  return {
    state,
    reason,
    expiringSoon,
    capabilities: runtime.capabilities,
    ...(runtime.status ? { status: runtime.status } : {}),
    ...(lastSeenAgeSeconds !== undefined ? { lastSeenAgeSeconds } : {}),
    ...(expiresInSeconds !== undefined ? { expiresInSeconds } : {}),
    ...(runtime.heartbeatTtlSeconds
      ? { heartbeatTtlSeconds: runtime.heartbeatTtlSeconds }
      : {}),
  };
}
