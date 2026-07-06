import { ServerAgentAuthService } from "./server-agent-auth.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { ServerExecutorExecutionRuntimeService } from "./server-executor-execution-runtime.service";
import { ServerExecutorQueueWorkerService } from "./server-executor-queue-worker.service";
import { ServerExecutorRunningCancellationService } from "./server-executor-running-cancellation.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";
import {
  ServerExecutorSupervisorHost,
  msToSupervisorSeconds,
} from "./server-executor-supervisor-host.types";

type ServerExecutorSupervisorHostOptions = {
  workerId: string;
  queueWorkerService: ServerExecutorQueueWorkerService;
  runningCancellationService: ServerExecutorRunningCancellationService;
  executionRuntimeService: ServerExecutorExecutionRuntimeService;
  runtimeConfigService: ServerExecutorRuntimeConfigService;
  agentAuthService: ServerAgentAuthService;
  capabilityService: ServerAgentCapabilityService;
};

export class ServerExecutorSupervisorHostService implements ServerExecutorSupervisorHost {
  constructor(private readonly options: ServerExecutorSupervisorHostOptions) {}

  get capability(): ServerAgentCapabilityService {
    return this.options.capabilityService;
  }

  getWorkerId(): string {
    return this.options.workerId;
  }

  getProcessingQueue(): boolean {
    return this.options.queueWorkerService.isProcessing();
  }

  getRunningCancellations(): number {
    return this.options.runningCancellationService.getRunningCount();
  }

  expireStaleLeases(now: Date, teamId?: string) {
    return this.options.executionRuntimeService.expireStaleLeases(now, teamId);
  }

  queueWorkerEnabled() {
    return this.options.runtimeConfigService.queueWorkerEnabled();
  }

  queueWorkerIntervalMs() {
    return this.options.runtimeConfigService.queueWorkerIntervalMs();
  }

  queueWorkerBatchSize() {
    return this.options.runtimeConfigService.queueWorkerBatchSize();
  }

  queueRetryDelayMs() {
    return this.options.runtimeConfigService.queueRetryDelayMs();
  }

  queueLockTtlMs() {
    return this.options.runtimeConfigService.queueLockTtlMs();
  }

  queueLockHeartbeatMs() {
    return this.options.runtimeConfigService.queueLockHeartbeatMs();
  }

  cancellationPollMs() {
    return this.options.runtimeConfigService.cancellationPollMs();
  }

  queueRecoveryBatchSize() {
    return this.options.runtimeConfigService.queueRecoveryBatchSize();
  }

  staleRemoteCleanupEnabled() {
    return this.options.runtimeConfigService.staleRemoteCleanupEnabled();
  }

  msToSeconds(ms: number) {
    return msToSupervisorSeconds(ms);
  }

  agentTargetEnabled() {
    return this.options.runtimeConfigService.agentTargetEnabled();
  }

  serverAgentTaskPullContractEnabled() {
    return this.options.agentAuthService.taskPullContractEnabled();
  }

  serverAgentTaskPullEnabled() {
    return this.options.agentAuthService.taskPullEnabled();
  }
}
