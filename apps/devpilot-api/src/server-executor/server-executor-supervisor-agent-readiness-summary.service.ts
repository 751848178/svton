import { Injectable } from "@nestjs/common";
import {
  ServerAgentCapabilityRef,
  ServerAgentReadinessRecord,
  ServerAgentRuntimeHealthSummary,
  ServerAgentRuntimeSummary,
} from "./server-executor-supervisor.types";
import { ServerExecutorSupervisorHost } from "./server-executor-supervisor-host.types";
import {
  readServerAgentCapability,
  readServerAgentRuntime,
  readServerAgentRuntimeHealth,
} from "./server-executor-agent-capability.utils";

@Injectable()
export class ServerExecutorSupervisorAgentReadinessSummaryService {
  summarizeReadiness(
    servers: ServerAgentReadinessRecord[],
    now: Date,
    host: ServerExecutorSupervisorHost,
  ) {
    const samples: {
      id: string;
      name: string;
      host: string;
      status: string;
      agentRef: ServerAgentCapabilityRef;
      runtime?: ServerAgentRuntimeSummary;
    }[] = [];
    const statusCounts = new Map<string, number>();
    let serviceCapabilityServers = 0;
    let tagCapabilityServers = 0;
    let onlineCapableServers = 0;
    let heartbeatServers = 0;
    let runtimeOnlineServers = 0;
    let runtimeStaleServers = 0;
    let runtimeUnknownServers = 0;

    for (const server of servers) {
      const agentRef = readServerAgentCapability(server);
      if (!agentRef) continue;
      const runtime = readServerAgentRuntime(server, now);

      if (agentRef.source === "server_services") serviceCapabilityServers += 1;
      if (agentRef.source === "server_tags") tagCapabilityServers += 1;
      if (server.status === "online") onlineCapableServers += 1;
      if (runtime) {
        heartbeatServers += 1;
        if (runtime.state === "online") runtimeOnlineServers += 1;
        if (runtime.state === "stale") runtimeStaleServers += 1;
        if (runtime.state === "unknown") runtimeUnknownServers += 1;
      }

      const status = agentRef.status || "unknown";
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

      if (samples.length < 10) {
        samples.push({
          id: server.id,
          name: server.name,
          host: server.host,
          status: server.status,
          agentRef,
          ...(runtime ? { runtime } : {}),
        });
      }
    }

    return {
      targetSelectionEnabled: host.agentTargetEnabled(),
      totalServers: servers.length,
      capableServers: serviceCapabilityServers + tagCapabilityServers,
      serviceCapabilityServers,
      tagCapabilityServers,
      onlineCapableServers,
      runtime: {
        heartbeatEnabled: host.capability.heartbeatEnabled(),
        tokenConfigured: host.capability.heartbeatTokenConfigured(),
        requiredForTargetSelection:
          host.capability.heartbeatRequiredForTargetSelection(),
        defaultTtlSeconds: host.capability.heartbeatDefaultTtlSeconds(),
        heartbeatServers,
        onlineServers: runtimeOnlineServers,
        staleServers: runtimeStaleServers,
        unknownServers: runtimeUnknownServers,
      },
      statusCounts: [...statusCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([status, count]) => ({ status, count })),
      samples,
    };
  }

  summarizeRuntimeHealth(
    servers: ServerAgentReadinessRecord[],
    now: Date,
    defaultTtlSeconds: number,
  ) {
    const samples: {
      id: string;
      name: string;
      host: string;
      status: string;
      agentRef: ServerAgentCapabilityRef;
      health: ServerAgentRuntimeHealthSummary;
    }[] = [];
    const statusCounts = new Map<string, number>();
    let totalServers = 0;
    let readyServers = 0;
    let degradedServers = 0;
    let staleServers = 0;
    let unknownServers = 0;
    let missingHeartbeatServers = 0;
    let expiringSoonServers = 0;

    for (const server of servers) {
      const agentRef = readServerAgentCapability(server);
      if (!agentRef) continue;
      totalServers += 1;

      const runtime = readServerAgentRuntime(server, now);
      const health = readServerAgentRuntimeHealth(
        runtime,
        now,
        defaultTtlSeconds,
      );
      if (health.state === "ready") readyServers += 1;
      if (health.state === "degraded") degradedServers += 1;
      if (health.state === "stale") staleServers += 1;
      if (health.state === "unknown") unknownServers += 1;
      if (health.state === "missing") missingHeartbeatServers += 1;
      if (health.expiringSoon) expiringSoonServers += 1;

      const status = health.status || health.state;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

      if (
        (health.state !== "ready" || health.expiringSoon) &&
        samples.length < 10
      ) {
        samples.push({
          id: server.id,
          name: server.name,
          host: server.host,
          status: server.status,
          agentRef,
          health,
        });
      }
    }

    return {
      totalServers,
      readyServers,
      degradedServers,
      staleServers,
      unknownServers,
      missingHeartbeatServers,
      expiringSoonServers,
      statusCounts: [...statusCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([status, count]) => ({ status, count })),
      samples,
    };
  }
}
