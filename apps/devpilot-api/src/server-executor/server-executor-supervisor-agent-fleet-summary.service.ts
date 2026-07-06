import { Injectable } from "@nestjs/common";
import {
  ServerAgentDispatcherConfig,
  ServerAgentFleetJobRecord,
  ServerAgentReadinessRecord,
} from "./server-executor-supervisor.types";
import {
  readServerAgentCapability,
  readServerAgentRuntime,
  readServerAgentRuntimeHealth,
} from "./server-executor-agent-capability.utils";
import {
  pickServerAgentNextQueuedJob,
  readServerAgentBlockedJobSummary,
  readServerAgentFleetBlockingReasons,
  serializeServerAgentFleetJob,
} from "./server-executor-supervisor-agent-job.utils";

type FleetJobStats = {
  ready: number;
  scheduled: number;
  running: number;
  staleRunning: number;
  blocked: number;
  failed: number;
  cancelled: number;
  pressure: number;
  nextQueuedJob?: ServerAgentFleetJobRecord;
  blockedSample?: ServerAgentFleetJobRecord;
};

const EMPTY_STATS: FleetJobStats = {
  ready: 0,
  scheduled: 0,
  running: 0,
  staleRunning: 0,
  blocked: 0,
  failed: 0,
  cancelled: 0,
  pressure: 0,
};

@Injectable()
export class ServerExecutorSupervisorAgentFleetSummaryService {
  summarizeFleet(
    servers: ServerAgentReadinessRecord[],
    jobs: ServerAgentFleetJobRecord[],
    now: Date,
    dispatcher: ServerAgentDispatcherConfig,
    defaultTtlSeconds: number,
    heartbeatRequired: boolean,
  ) {
    const jobStatsByServer = new Map<string, FleetJobStats>();
    const ensureStats = (serverId: string) => {
      const existing = jobStatsByServer.get(serverId);
      if (existing) return existing;
      const created: FleetJobStats = { ...EMPTY_STATS };
      jobStatsByServer.set(serverId, created);
      return created;
    };

    for (const job of jobs) {
      if (!job.serverId) continue;
      const stats = ensureStats(job.serverId);
      this.tallyJob(stats, job, now);
      stats.pressure =
        stats.ready + stats.running + stats.blocked + stats.failed;
    }

    const items = [];
    let liveDispatchReadyServers = 0;
    let pressureServers = 0;
    for (const server of servers) {
      const agentRef = readServerAgentCapability(server);
      if (!agentRef) continue;
      const runtime = readServerAgentRuntime(server, now);
      const runtimeHealth = readServerAgentRuntimeHealth(
        runtime,
        now,
        defaultTtlSeconds,
      );
      const targetReady =
        server.status === "online" &&
        (heartbeatRequired ? runtime?.state === "online" : true);
      const liveDispatchReady =
        targetReady &&
        dispatcher.executorEnabled &&
        dispatcher.dispatcherConfigured;
      const blockingReasons = readServerAgentFleetBlockingReasons(
        server,
        runtime,
        heartbeatRequired,
        dispatcher,
      );
      const stats = jobStatsByServer.get(server.id) || EMPTY_STATS;
      if (liveDispatchReady) liveDispatchReadyServers += 1;
      if (stats.pressure > 0) pressureServers += 1;
      items.push({
        id: server.id,
        name: server.name,
        host: server.host,
        status: server.status,
        agentRef,
        ...(runtime ? { runtime } : {}),
        runtimeHealth,
        readiness: { targetReady, liveDispatchReady, blockingReasons },
        jobs: {
          ready: stats.ready,
          scheduled: stats.scheduled,
          running: stats.running,
          staleRunning: stats.staleRunning,
          blocked: stats.blocked,
          failed: stats.failed,
          cancelled: stats.cancelled,
          pressure: stats.pressure,
          nextQueuedJob: stats.nextQueuedJob
            ? serializeServerAgentFleetJob(stats.nextQueuedJob)
            : null,
          blockedSample: stats.blockedSample
            ? {
                ...serializeServerAgentFleetJob(stats.blockedSample),
                ...readServerAgentBlockedJobSummary(stats.blockedSample),
              }
            : null,
        },
      });
    }

    const sortedItems = items.sort(
      (left, right) =>
        right.jobs.pressure - left.jobs.pressure ||
        Number(right.readiness.liveDispatchReady) -
          Number(left.readiness.liveDispatchReady) ||
        left.name.localeCompare(right.name),
    );
    const itemLimit = 25;
    return {
      totalServers: items.length,
      liveDispatchReadyServers,
      pressureServers,
      scannedJobs: jobs.length,
      truncated: sortedItems.length > itemLimit,
      items: sortedItems.slice(0, itemLimit),
    };
  }

  private tallyJob(
    stats: FleetJobStats,
    job: ServerAgentFleetJobRecord,
    now: Date,
  ) {
    if (job.status === "queued" && job.queueMode === "queued") {
      if (job.availableAt.getTime() <= now.getTime()) stats.ready += 1;
      else stats.scheduled += 1;
      stats.nextQueuedJob = pickServerAgentNextQueuedJob(
        stats.nextQueuedJob,
        job,
      );
    } else if (job.status === "running") {
      stats.running += 1;
      if (job.lockExpiresAt && job.lockExpiresAt.getTime() <= now.getTime())
        stats.staleRunning += 1;
    } else if (job.status === "blocked") {
      stats.blocked += 1;
      if (!stats.blockedSample) stats.blockedSample = job;
    } else if (job.status === "failed") {
      stats.failed += 1;
    } else if (job.status === "cancelled") {
      stats.cancelled += 1;
    }
  }
}
