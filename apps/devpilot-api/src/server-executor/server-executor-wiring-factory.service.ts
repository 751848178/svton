import type { Logger } from "@nestjs/common";
import type { AuditEventService } from "../audit-event";
import { LogCollectionIngestionService } from "../log-center/log-collection-ingestion.service";
import { PrismaService } from "../prisma/prisma.service";
import type { ReleaseCoordinatorPort } from "../release-orchestration/release-coordinator.port";
import type { ResolveDevpilotSecretsFn } from "./server-executor-secret-reapply.utils";
import type { DistributedLock } from "../common/lock/distributed-lock";
import { ServerAgentServerExecutorAdapter } from "./adapters/server-agent.adapter";
import { ScriptPlanServerExecutorAdapter } from "./adapters/script-plan.adapter";
import { SshLiveServerExecutorAdapter } from "./adapters/ssh-live.adapter";
import type { JobQueuePort } from "./queue/job-queue.port";
import { ServerAgentAuthService } from "./server-agent-auth.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { ServerCommandPolicyService } from "./server-command-policy.service";
import { ServerExecutorAuditService } from "./server-executor-audit.service";
import { ServerExecutorExecutionCoreFactoryService } from "./server-executor-execution-core-factory.service";
import { ServerExecutorLinkedBusinessRunSyncFactoryService } from "./server-executor-linked-business-run-sync-factory.service";
import { ServerExecutorQueueGovernanceFactoryService } from "./server-executor-queue-governance-factory.service";
import { ServerExecutorRemoteExecutionMetadataService } from "./server-executor-remote-execution-metadata.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";
import { ServerExecutorSubmissionService } from "./server-executor-submission.service";
import { ServerExecutorSupervisorHostService } from "./server-executor-supervisor-host.service";
import { wireAgentTaskPullServices } from "./server-executor-agent-task-pull-wiring.utils";
import { wireReadQueryServices } from "./server-executor-read-query-wiring.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerQueuedExecutionOptions,
  ServerQueuedExecutionResult,
} from "./server-executor.types";

type WiringLogger = Pick<Logger, "error" | "log" | "warn">;

type ServerExecutorWiringFactoryOptions = {
  workerId: string;
  distributedLock: DistributedLock;
  jobQueue?: JobQueuePort;
  // 发布编排完成回调端口（F383 D3）；可选——flag 关闭时为 undefined。
  releaseCoordinator?: ReleaseCoordinatorPort;
  // F383 P0-A：发布凭据解析回调（队列执行边界重解析 $DEVPILOT_* 秘密）；可选。
  resolveDevpilotSecrets?: ResolveDevpilotSecretsFn;
  sshLiveAdapter: SshLiveServerExecutorAdapter;
  serverAgentAdapter?: ServerAgentServerExecutorAdapter;
  scriptPlanAdapter: ScriptPlanServerExecutorAdapter;
  commandPolicy: ServerCommandPolicyService;
  logCollectionIngestionService: LogCollectionIngestionService;
  agentCapabilityService: ServerAgentCapabilityService;
  agentAuthService: ServerAgentAuthService;
  runtimeConfigService: ServerExecutorRuntimeConfigService;
  remoteExecutionMetadataService: ServerExecutorRemoteExecutionMetadataService;
  auditEventService?: AuditEventService;
  logger: WiringLogger;
  queueExecution: (
    input: ServerExecutionInput,
    options?: ServerQueuedExecutionOptions,
  ) => Promise<ServerQueuedExecutionResult>;
  executeInline: (
    input: ServerExecutionInput,
  ) => Promise<ServerExecutionResult>;
  recoverStaleRunningJobs: (
    teamId?: string,
    actorId?: string,
  ) => Promise<unknown>;
  processNextQueuedJob: () => Promise<{ processed: boolean }>;
};

export class ServerExecutorWiringFactoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly options: ServerExecutorWiringFactoryOptions,
  ) {}

  create() {
    const linkedBusinessRunSyncService =
      new ServerExecutorLinkedBusinessRunSyncFactoryService(
        this.prisma,
        this.options.logCollectionIngestionService,
        this.options.logger,
        this.options.queueExecution,
        this.options.releaseCoordinator,
      ).create();
    const auditService = new ServerExecutorAuditService(
      this.options.auditEventService,
      this.options.logger,
    );
    const executionCoreServices = new ServerExecutorExecutionCoreFactoryService(
      this.prisma,
      {
        workerId: this.options.workerId,
        distributedLock: this.options.distributedLock,
        jobQueue: this.options.jobQueue,
        sshLiveAdapter: this.options.sshLiveAdapter,
        serverAgentAdapter: this.options.serverAgentAdapter,
        scriptPlanAdapter: this.options.scriptPlanAdapter,
        commandPolicy: this.options.commandPolicy,
        linkedBusinessRunSyncService,
        remoteExecutionMetadataService:
          this.options.remoteExecutionMetadataService,
        auditService,
        runtimeConfigService: this.options.runtimeConfigService,
        logger: this.options.logger,
      },
    ).create();
    const queueGovernanceServices =
      new ServerExecutorQueueGovernanceFactoryService(this.prisma, {
        workerId: this.options.workerId,
        jobQueue: this.options.jobQueue,
        sshLiveAdapter: this.options.sshLiveAdapter,
        remoteExecutionMetadataService:
          this.options.remoteExecutionMetadataService,
        jobLifecycleWriteService:
          executionCoreServices.jobLifecycleWriteService,
        auditService,
        executeInline: this.options.executeInline,
        recoverStaleRunningJobs: this.options.recoverStaleRunningJobs,
        runJob: (input, job) =>
          executionCoreServices.jobRunnerService.run(input, job),
        processNextQueuedJob: this.options.processNextQueuedJob,
        resolveDevpilotSecrets: this.options.resolveDevpilotSecrets,
        lockExpiresAt: (now) =>
          this.options.runtimeConfigService.lockExpiresAt(now),
        queueRetryDelayMs: () =>
          this.options.runtimeConfigService.queueRetryDelayMs(),
        queueRecoveryBatchSize: () =>
          this.options.runtimeConfigService.queueRecoveryBatchSize(),
        queueWorkerEnabled: () =>
          this.options.runtimeConfigService.queueWorkerEnabled(),
        queueWorkerIntervalMs: () =>
          this.options.runtimeConfigService.queueWorkerIntervalMs(),
        queueWorkerBatchSize: () =>
          this.options.runtimeConfigService.queueWorkerBatchSize(),
        staleRemoteCleanupEnabled: () =>
          this.options.runtimeConfigService.staleRemoteCleanupEnabled(),
        logger: this.options.logger,
      }).create();
    const submissionService = new ServerExecutorSubmissionService(
      executionCoreServices,
    );
    // agent-task-pull 服务集群装配（抽离到 wiring utils，单一职责）。
    const {
      agentTaskPullQueryService,
      agentTaskPullClaimService,
      agentRuntimeEndpointService,
    } = wireAgentTaskPullServices({
      prisma: this.prisma,
      jobQueue: this.options.jobQueue,
      logCollectionIngestionService: this.options.logCollectionIngestionService,
      agentAuthService: this.options.agentAuthService,
      agentCapabilityService: this.options.agentCapabilityService,
      runtimeConfigService: this.options.runtimeConfigService,
      commandPolicy: this.options.commandPolicy,
    });
    // 目标解析 + 读查询服务装配（抽离到 wiring utils）。
    const { targetResolutionService, readQueryService } = wireReadQueryServices({
      prisma: this.prisma,
      agentCapabilityService: this.options.agentCapabilityService,
      runtimeConfigService: this.options.runtimeConfigService,
      expireStaleLeases: (now, teamId) =>
        executionCoreServices.executionRuntimeService.expireStaleLeases(now, teamId),
    });
    const supervisorHostService = new ServerExecutorSupervisorHostService({
      workerId: this.options.workerId,
      queueWorkerService: queueGovernanceServices.queueWorkerService,
      runningCancellationService:
        executionCoreServices.runningCancellationService,
      executionRuntimeService: executionCoreServices.executionRuntimeService,
      runtimeConfigService: this.options.runtimeConfigService,
      agentAuthService: this.options.agentAuthService,
      capabilityService: this.options.agentCapabilityService,
    });

    return {
      linkedBusinessRunSyncService,
      auditService,
      executionCoreServices,
      submissionService,
      ...queueGovernanceServices,
      agentTaskPullQueryService,
      agentTaskPullClaimService,
      agentRuntimeEndpointService,
      targetResolutionService,
      readQueryService,
      supervisorHostService,
    };
  }
}

export type ServerExecutorWiringServices = ReturnType<
  ServerExecutorWiringFactoryService["create"]
>;
