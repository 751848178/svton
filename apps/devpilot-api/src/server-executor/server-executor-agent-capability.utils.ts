import {
  ServerAgentCapabilityRecord,
  ServerAgentCapabilityRef,
  ServerAgentReadinessRecord,
  ServerAgentRuntimeSummary,
} from "./server-executor-supervisor.types";
export { readServerAgentRuntimeHealth } from "./server-executor-agent-runtime-health.utils";
import {
  isSupervisorRecord,
  readSupervisorOptionalIsoDate,
  readSupervisorOptionalString,
  readSupervisorPositiveInteger,
  readSupervisorStringArray,
} from "./server-executor-supervisor-reader.utils";

const HEALTHY_AGENT_STATUSES = [
  "online",
  "ready",
  "healthy",
  "connected",
  "enabled",
];

export function isHealthyAgentStatus(status: string): boolean {
  return HEALTHY_AGENT_STATUSES.includes(status);
}

function readAgentServiceCapability(
  value: unknown,
): { status?: string } | null {
  if (value === true) {
    return { status: "enabled" };
  }

  if (typeof value === "string") {
    const status = value.toLowerCase();
    return isHealthyAgentStatus(status) ? { status } : null;
  }

  if (!isSupervisorRecord(value)) return null;

  const status = readSupervisorOptionalString(value.status)?.toLowerCase();
  const enabled =
    value.enabled === true ||
    value.installed === true ||
    value.available === true;
  if (status && isHealthyAgentStatus(status)) {
    return { status };
  }
  if (enabled) {
    return { status: status || "enabled" };
  }

  return null;
}

const SERVICE_KEYS = [
  "devpilotAgent",
  "serverAgent",
  "devpilot_agent",
  "server_agent",
  "agent",
];

export function readServerAgentCapability(
  server: ServerAgentCapabilityRecord,
): ServerAgentCapabilityRef | undefined {
  const services = isSupervisorRecord(server.services) ? server.services : {};

  for (const key of SERVICE_KEYS) {
    const capability = readAgentServiceCapability(services[key]);
    if (!capability) continue;

    return {
      source: "server_services",
      referenceId: server.id,
      displayName: `${server.name} agent`,
      capabilityKey: key,
      ...(capability.status ? { status: capability.status } : {}),
      redacted: true,
    };
  }

  const tags = Array.isArray(server.tags)
    ? server.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.toLowerCase())
    : [];
  const agentTag = tags.find((tag) =>
    [
      "devpilot-agent",
      "server-agent",
      "devpilot_agent",
      "server_agent",
    ].includes(tag),
  );
  if (!agentTag) return undefined;

  return {
    source: "server_tags",
    referenceId: server.id,
    displayName: `${server.name} agent`,
    capabilityKey: agentTag,
    status: "tagged",
    redacted: true,
  };
}

export function readServerAgentRuntime(
  server: Pick<ServerAgentReadinessRecord, "services">,
  now: Date,
): ServerAgentRuntimeSummary | undefined {
  const services = isSupervisorRecord(server.services) ? server.services : {};
  const heartbeat = services.devpilotAgent;
  if (!isSupervisorRecord(heartbeat)) return undefined;

  const source = readSupervisorOptionalString(heartbeat.source);
  const agentId = readSupervisorOptionalString(heartbeat.agentId);
  const status = readSupervisorOptionalString(heartbeat.status);
  const runnerId = readSupervisorOptionalString(heartbeat.runnerId);
  const hostname = readSupervisorOptionalString(heartbeat.hostname);
  const version = readSupervisorOptionalString(heartbeat.version);
  const heartbeatTtlSeconds = readSupervisorPositiveInteger(
    heartbeat.heartbeatTtlSeconds,
  );
  const lastSeenAt = readSupervisorOptionalIsoDate(heartbeat.lastSeenAt);
  const expiresAt = readSupervisorOptionalIsoDate(heartbeat.expiresAt);
  if (source !== "agent_heartbeat" && !agentId && !lastSeenAt && !expiresAt) {
    return undefined;
  }

  const state: ServerAgentRuntimeSummary["state"] = expiresAt
    ? expiresAt.getTime() >= now.getTime()
      ? "online"
      : "stale"
    : "unknown";

  return {
    state,
    capabilities: readSupervisorStringArray(heartbeat.capabilities).slice(
      0,
      50,
    ),
    ...(status ? { status } : {}),
    ...(agentId ? { agentId } : {}),
    ...(runnerId ? { runnerId } : {}),
    ...(hostname ? { hostname } : {}),
    ...(version ? { version } : {}),
    ...(lastSeenAt ? { lastSeenAt: lastSeenAt.toISOString() } : {}),
    ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
    ...(heartbeatTtlSeconds ? { heartbeatTtlSeconds } : {}),
  };
}
