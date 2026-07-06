import { Injectable } from "@nestjs/common";
import { ServerAgentBlockedJobRecord } from "./server-executor-supervisor.types";
import { readServerAgentBlockedJobSummary } from "./server-executor-supervisor-agent-job.utils";

@Injectable()
export class ServerExecutorSupervisorAgentBlockedReasonsSummaryService {
  summarize(jobs: ServerAgentBlockedJobRecord[]) {
    const reasonCounts = new Map<
      string,
      { reason: string; count: number; nextExecutorBoundary?: string }
    >();
    const samples = [];
    let dispatcherBoundaryJobs = 0;

    for (const job of jobs) {
      const blocked = readServerAgentBlockedJobSummary(job);
      if (blocked.nextExecutorBoundary === "server_agent_dispatcher")
        dispatcherBoundaryJobs += 1;

      const key = `${blocked.reason}\u0000${blocked.nextExecutorBoundary || ""}`;
      const existing = reasonCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        reasonCounts.set(key, {
          reason: blocked.reason,
          count: 1,
          ...(blocked.nextExecutorBoundary
            ? { nextExecutorBoundary: blocked.nextExecutorBoundary }
            : {}),
        });
      }

      if (samples.length < 5) {
        samples.push({
          id: job.id,
          operationKey: job.operationKey,
          adapterKey: job.adapterKey,
          serverId: job.serverId,
          queuedAt: job.queuedAt.toISOString(),
          finishedAt: job.finishedAt?.toISOString() ?? null,
          server: job.server,
          ...blocked,
        });
      }
    }

    return {
      scanned: jobs.length,
      dispatcherBoundaryJobs,
      reasonCounts: [...reasonCounts.values()].sort(
        (left, right) =>
          right.count - left.count || left.reason.localeCompare(right.reason),
      ),
      samples,
    };
  }
}
