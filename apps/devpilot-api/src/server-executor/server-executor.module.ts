import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AuditEventModule } from "../audit-event";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { LogIngestionModule } from "../log-center/log-ingestion.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ServerModule } from "../server/server.module";
import { ServerAgentServerExecutorAdapter } from "./adapters/server-agent.adapter";
import { SshLiveServerExecutorAdapter } from "./adapters/ssh-live.adapter";
import { ScriptPlanServerExecutorAdapter } from "./adapters/script-plan.adapter";
import { ServerCommandPolicyService } from "./server-command-policy.service";
import { ServerAgentAuthService } from "./server-agent-auth.service";
import { ServerAgentCapabilityService } from "./server-agent-capability.service";
import { ServerExecutorRuntimeConfigService } from "./server-executor-runtime-config.service";
import { ServerExecutorRemoteExecutionMetadataService } from "./server-executor-remote-execution-metadata.service";
import { ServerCommandPolicyTemplateMatcherService } from "./server-command-policy-template-matcher.service";
import { ServerCommandPolicyTemplateRepository } from "./server-command-policy-template.repository";
import { ServerCommandPolicyTemplateService } from "./server-command-policy-template.service";
import { ServerCommandPolicyTemplateController } from "./server-command-policy-template.controller";
import { ServerAgentController } from "./server-agent.controller";
import { ServerExecutionJobController } from "./server-execution-job.controller";
import { ServerExecutionLeaseController } from "./server-execution-lease.controller";
import { ServerExecutorService } from "./server-executor.service";
import { ServerExecutorSupervisorService } from "./server-executor-supervisor.service";
import { ServerExecutorSupervisorQueryService } from "./server-executor-supervisor-query.service";
import { ServerExecutorSupervisorJobQueryService } from "./server-executor-supervisor-job-query.service";
import { ServerExecutorSupervisorAgentJobQueryService } from "./server-executor-supervisor-agent-job-query.service";
import { ServerExecutorSupervisorWorkerSummaryService } from "./server-executor-supervisor-worker-summary.service";
import { ServerExecutorSupervisorInventorySummaryService } from "./server-executor-supervisor-inventory-summary.service";
import { ServerExecutorSupervisorQueueCoordinationSummaryService } from "./server-executor-supervisor-queue-coordination-summary.service";
import { ServerExecutorSupervisorRemoteOrphanSummaryService } from "./server-executor-supervisor-remote-orphan-summary.service";
import { ServerExecutorSupervisorAgentReadinessSummaryService } from "./server-executor-supervisor-agent-readiness-summary.service";
import { ServerExecutorSupervisorAgentBlockedReasonsSummaryService } from "./server-executor-supervisor-agent-blocked-reasons-summary.service";
import { ServerExecutorSupervisorAgentFleetSummaryService } from "./server-executor-supervisor-agent-fleet-summary.service";
import { ServerExecutorSupervisorAgentLifecycleSummaryService } from "./server-executor-supervisor-agent-lifecycle-summary.service";
import { ServerExecutorSupervisorAgentTaskPullSummaryService } from "./server-executor-supervisor-agent-task-pull-summary.service";

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    ServerModule,
    ControlAccessPolicyModule,
    LogIngestionModule,
    AuditEventModule,
  ],
  controllers: [
    ServerAgentController,
    ServerExecutionLeaseController,
    ServerExecutionJobController,
    ServerCommandPolicyTemplateController,
  ],
  providers: [
    ServerExecutorService,
    ServerAgentAuthService,
    ServerAgentCapabilityService,
    ServerExecutorRuntimeConfigService,
    ServerExecutorRemoteExecutionMetadataService,
    ServerExecutorSupervisorService,
    ServerExecutorSupervisorQueryService,
    ServerExecutorSupervisorJobQueryService,
    ServerExecutorSupervisorAgentJobQueryService,
    ServerExecutorSupervisorWorkerSummaryService,
    ServerExecutorSupervisorInventorySummaryService,
    ServerExecutorSupervisorQueueCoordinationSummaryService,
    ServerExecutorSupervisorRemoteOrphanSummaryService,
    ServerExecutorSupervisorAgentReadinessSummaryService,
    ServerExecutorSupervisorAgentBlockedReasonsSummaryService,
    ServerExecutorSupervisorAgentFleetSummaryService,
    ServerExecutorSupervisorAgentLifecycleSummaryService,
    ServerExecutorSupervisorAgentTaskPullSummaryService,
    ServerCommandPolicyService,
    ServerCommandPolicyTemplateService,
    ServerCommandPolicyTemplateMatcherService,
    ServerCommandPolicyTemplateRepository,
    ScriptPlanServerExecutorAdapter,
    SshLiveServerExecutorAdapter,
    ServerAgentServerExecutorAdapter,
  ],
  exports: [ServerExecutorService],
})
export class ServerExecutorModule {}
