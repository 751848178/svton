import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { AuditEventService } from "../audit-event";
import { LogCollectionIngestionService } from "../log-center/log-collection-ingestion.service";
import { PrismaService } from "../prisma/prisma.service";
import { ServerAgentServerExecutorAdapter } from "./adapters/server-agent.adapter";
import { ScriptPlanServerExecutorAdapter } from "./adapters/script-plan.adapter";
import { SshLiveServerExecutorAdapter } from "./adapters/ssh-live.adapter";
import { JobQueuePort, JOB_QUEUE_PORT } from "./queue/job-queue.port";
import {
  DISTRIBUTED_LOCK,
  DistributedLock,
} from "../common/lock/distributed-lock";
import { NoopDistributedLock } from "../common/lock/noop-distributed-lock";
import {
  ListServerExecutionJobsQueryDto,
  ListServerExecutionLeasesQueryDto,
  RetryServerExecutionJobDto,
  ServerAgentHeartbeatDto,
  ServerAgentTaskPullContractDto,
} from "./dto/server-execution-lease.dto";
import { ServerAgentAuthService } from "./server-agent-auth.service";
import type { HeaderBag } from "./server-agent-auth.service";
import { ServerCommandPolicyService } from "./server-command-policy.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { ServerExecutorRemoteExecutionMetadataService } from "./server-executor-remote-execution-metadata.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";
import { ServerExecutorSupervisorService } from "./server-executor-supervisor.service";
import {
  ServerExecutorWiringFactoryService,
  ServerExecutorWiringServices,
} from "./server-executor-wiring-factory.service";
import {
  ServerExecutionInput,
  ServerQueuedExecutionOptions,
} from "./server-executor.types";

@Injectable()
export class ServerExecutorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServerExecutorService.name);
  private readonly workerId = `server-executor-${randomUUID()}`;
  private readonly services: ServerExecutorWiringServices;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sshLiveAdapter: SshLiveServerExecutorAdapter,
    private readonly scriptPlanAdapter: ScriptPlanServerExecutorAdapter,
    private readonly commandPolicy: ServerCommandPolicyService,
    private readonly configService: ConfigService,
    private readonly logCollectionIngestionService: LogCollectionIngestionService,
    private readonly supervisorService: ServerExecutorSupervisorService,
    private readonly agentCapabilityService: ServerAgentCapabilityService,
    auditEventService?: AuditEventService,
    private readonly serverAgentAdapter?: ServerAgentServerExecutorAdapter,
    @Optional()
    @Inject(JOB_QUEUE_PORT)
    private readonly jobQueue?: JobQueuePort,
    @Optional()
    @Inject(DISTRIBUTED_LOCK)
    private readonly distributedLock: DistributedLock = new NoopDistributedLock(),
    private readonly agentAuthService: ServerAgentAuthService = new ServerAgentAuthService(
      configService,
      agentCapabilityService,
    ),
    private readonly runtimeConfigService: ServerExecutorRuntimeConfigService = new ServerExecutorRuntimeConfigService(
      configService,
    ),
    private readonly remoteExecutionMetadataService: ServerExecutorRemoteExecutionMetadataService = new ServerExecutorRemoteExecutionMetadataService(
      prisma,
    ),
  ) {
    this.services = new ServerExecutorWiringFactoryService(prisma, {
      workerId: this.workerId,
      distributedLock: this.distributedLock,
      jobQueue: this.jobQueue,
      sshLiveAdapter: this.sshLiveAdapter,
      serverAgentAdapter: this.serverAgentAdapter,
      scriptPlanAdapter: this.scriptPlanAdapter,
      commandPolicy: this.commandPolicy,
      logCollectionIngestionService,
      agentCapabilityService: this.agentCapabilityService,
      agentAuthService: this.agentAuthService,
      runtimeConfigService: this.runtimeConfigService,
      remoteExecutionMetadataService: this.remoteExecutionMetadataService,
      auditEventService,
      logger: this.logger,
      queueExecution: (queueInput, options) =>
        this.queueExecution(queueInput, options),
      executeInline: (input) => this.execute(input),
      recoverStaleRunningJobs: (teamId, actorId) =>
        this.recoverStaleRunningJobs(teamId, actorId),
      processNextQueuedJob: () => this.processNextQueuedJob(),
    }).create();
  }

  onModuleInit() {
    this.services.queueWorkerService.start();
  }

  onModuleDestroy() {
    this.services.queueWorkerService.stop();
    this.services.executionCoreServices.runningCancellationService.cancelAndStopAll();
  }

  async resolveTarget(teamId: string, serverId?: string | null) {
    return this.services.targetResolutionService.resolveTarget(
      teamId,
      serverId,
    );
  }

  async execute(input: ServerExecutionInput) {
    return this.services.submissionService.execute(input);
  }

  async queueExecution(
    input: ServerExecutionInput,
    options: ServerQueuedExecutionOptions = {},
  ) {
    return this.services.submissionService.queueExecution(input, options);
  }

  async listLeases(teamId: string, query: ListServerExecutionLeasesQueryDto) {
    return this.services.readQueryService.listLeases(teamId, query);
  }

  async expireStaleLeasesForTeam(teamId: string) {
    return this.services.readQueryService.expireStaleLeasesForTeam(teamId);
  }

  async listJobs(teamId: string, query: ListServerExecutionJobsQueryDto) {
    return this.services.readQueryService.listJobs(teamId, query);
  }

  getSupervisorSnapshot(teamId: string) {
    return this.supervisorService.buildSnapshot(
      teamId,
      this.services.supervisorHostService,
    );
  }

  recordServerAgentHeartbeat(headers: HeaderBag, dto: ServerAgentHeartbeatDto) {
    return this.services.agentRuntimeEndpointService.recordHeartbeat(
      headers,
      dto,
    );
  }

  async readServerAgentTaskPullContract(
    headers: HeaderBag,
    dto: ServerAgentTaskPullContractDto,
  ) {
    return this.services.agentRuntimeEndpointService.readTaskPullContract(
      headers,
      dto,
    );
  }

  async cancelJob(teamId: string, userId: string, id: string) {
    return this.services.submissionService.cancelJob(teamId, userId, id);
  }

  async retryJob(
    teamId: string,
    userId: string,
    id: string,
    dto: RetryServerExecutionJobDto,
  ) {
    return this.services.jobRetryService.retryJob(teamId, userId, id, dto);
  }

  async processNextQueuedJob(teamId?: string, actorId?: string) {
    return this.services.queuedJobProcessingService.processNextQueuedJob(
      teamId,
      actorId,
    );
  }

  async recoverStaleRunningJobs(teamId?: string, actorId?: string) {
    return this.services.staleRunningJobRecoveryService.recoverStaleRunningJobs(
      teamId,
      actorId,
    );
  }
}
