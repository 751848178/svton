/**
 * Snapshot-time capabilities the supervisor snapshot service needs from the host
 * executor service. Kept as an explicit interface so the dependency direction is
 * one-way (host -> supervisor) and the supervisor never injects the host back.
 *
 * Agent capability/runtime/dispatcher reads are provided via the shared
 * `ServerAgentCapabilityService` (see `capability`), so the host interface only
 * owns worker identity, queue worker config, and agent target/task-pull flags.
 */
import { ServerAgentCapabilityService } from "./server-agent-capability.service";

export interface ServerExecutorSupervisorHost {
  getWorkerId(): string;
  getProcessingQueue(): boolean;
  getRunningCancellations(): number;
  expireStaleLeases(now: Date, teamId?: string): Promise<unknown>;
  queueWorkerEnabled(): boolean;
  queueWorkerIntervalMs(): number;
  queueWorkerBatchSize(): number;
  queueRetryDelayMs(): number;
  queueLockTtlMs(): number;
  queueLockHeartbeatMs(): number;
  cancellationPollMs(): number;
  queueRecoveryBatchSize(): number;
  staleRemoteCleanupEnabled(): boolean;
  msToSeconds(ms: number): number;
  agentTargetEnabled(): boolean;
  serverAgentTaskPullContractEnabled(): boolean;
  serverAgentTaskPullEnabled(): boolean;
  readonly capability: ServerAgentCapabilityService;
}

export function msToSupervisorSeconds(ms: number): number {
  return Math.round(ms / 1000);
}
