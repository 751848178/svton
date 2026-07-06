import type { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DistributedLock } from "../common/lock/distributed-lock";
import { ServerAgentServerExecutorAdapter } from "./adapters/server-agent.adapter";
import { ScriptPlanServerExecutorAdapter } from "./adapters/script-plan.adapter";
import { SshLiveServerExecutorAdapter } from "./adapters/ssh-live.adapter";
import type { JobQueuePort } from "./queue/job-queue.port";
import { ServerCommandPolicyService } from "./server-command-policy.service";
import { ServerExecutorAuditService } from "./server-executor-audit.service";
import { ServerExecutorCancellationTokenService } from "./server-executor-cancellation-token.service";
import { ServerExecutorExecutionRuntimeService } from "./server-executor-execution-runtime.service";
import { ServerExecutorJobCancellationService } from "./server-executor-job-cancellation.service";
import { ServerExecutorJobCompletionService } from "./server-executor-job-completion.service";
import { ServerExecutorJobHeartbeatService } from "./server-executor-job-heartbeat.service";
import { ServerExecutorJobLifecycleWriteService } from "./server-executor-job-lifecycle-write.service";
import { ServerExecutorJobRunnerService } from "./server-executor-job-runner.service";
import { ServerExecutorLinkedBusinessRunSyncService } from "./server-executor-linked-business-run-sync.service";
import { ServerExecutorLiveLeaseService } from "./server-executor-live-lease.service";
import { ServerExecutorRemoteExecutionMetadataService } from "./server-executor-remote-execution-metadata.service";
import { ServerExecutorRunningCancellationService } from "./server-executor-running-cancellation.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";

type ExecutionCoreFactoryOptions = {
  workerId: string;
  distributedLock: DistributedLock;
  jobQueue?: JobQueuePort;
  sshLiveAdapter: SshLiveServerExecutorAdapter;
  serverAgentAdapter?: ServerAgentServerExecutorAdapter;
  scriptPlanAdapter: ScriptPlanServerExecutorAdapter;
  commandPolicy: ServerCommandPolicyService;
  linkedBusinessRunSyncService: ServerExecutorLinkedBusinessRunSyncService;
  remoteExecutionMetadataService: ServerExecutorRemoteExecutionMetadataService;
  auditService: ServerExecutorAuditService;
  runtimeConfigService: ServerExecutorRuntimeConfigService;
  logger: Pick<Logger, "warn">;
};

export class ServerExecutorExecutionCoreFactoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly options: ExecutionCoreFactoryOptions,
  ) {}

  create() {
    const cancellationTokenService = new ServerExecutorCancellationTokenService(
      this.prisma,
    );
    const runningCancellationService =
      new ServerExecutorRunningCancellationService();
    const liveLeaseService = new ServerExecutorLiveLeaseService(
      this.prisma,
      this.options.distributedLock,
      this.options.jobQueue,
    );
    const jobHeartbeatService = new ServerExecutorJobHeartbeatService(
      this.prisma,
      this.options.jobQueue,
    );
    const jobCancellationService = new ServerExecutorJobCancellationService(
      this.prisma,
      this.options.auditService,
      (jobId) => runningCancellationService.cancel(jobId),
    );
    const jobLifecycleWriteService = new ServerExecutorJobLifecycleWriteService(
      this.prisma,
      this.options.workerId,
      (now) => this.options.runtimeConfigService.lockExpiresAt(now),
      this.options.jobQueue,
    );
    const adapters = [
      this.options.sshLiveAdapter,
      ...(this.options.serverAgentAdapter
        ? [this.options.serverAgentAdapter]
        : []),
      this.options.scriptPlanAdapter,
    ];
    const executionRuntimeService = new ServerExecutorExecutionRuntimeService(
      adapters,
      liveLeaseService,
      jobHeartbeatService,
      this.options.workerId,
      () => this.options.runtimeConfigService.leaseTtlMs(),
      () => this.options.runtimeConfigService.queueLockHeartbeatMs(),
      (now) => this.options.runtimeConfigService.lockExpiresAt(now),
    );
    const jobCompletionService = new ServerExecutorJobCompletionService(
      executionRuntimeService,
      jobLifecycleWriteService,
      this.options.linkedBusinessRunSyncService,
    );
    const jobRunnerService = new ServerExecutorJobRunnerService(
      this.options.commandPolicy,
      cancellationTokenService,
      runningCancellationService,
      executionRuntimeService,
      this.options.remoteExecutionMetadataService,
      jobLifecycleWriteService,
      this.options.linkedBusinessRunSyncService,
      jobCompletionService,
      this.options.auditService,
      () => this.options.runtimeConfigService.cancellationPollMs(),
      this.options.logger,
    );

    return {
      adapters,
      cancellationTokenService,
      runningCancellationService,
      liveLeaseService,
      jobHeartbeatService,
      jobCancellationService,
      jobLifecycleWriteService,
      executionRuntimeService,
      jobCompletionService,
      jobRunnerService,
    };
  }
}

export type ServerExecutorExecutionCoreServices = ReturnType<
  ServerExecutorExecutionCoreFactoryService["create"]
>;
