import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { LogIngestionModule } from '../log-center/log-ingestion.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ServerModule } from '../server/server.module';
import { SshLiveServerExecutorAdapter } from './adapters/ssh-live.adapter';
import { ScriptPlanServerExecutorAdapter } from './adapters/script-plan.adapter';
import { ServerCommandPolicyService } from './server-command-policy.service';
import { ServerCommandPolicyTemplateController } from './server-command-policy-template.controller';
import { ServerExecutionJobController } from './server-execution-job.controller';
import { ServerExecutionLeaseController } from './server-execution-lease.controller';
import { ServerExecutorService } from './server-executor.service';

@Module({
  imports: [PrismaModule, ServerModule, ControlAccessPolicyModule, LogIngestionModule],
  controllers: [
    ServerExecutionLeaseController,
    ServerExecutionJobController,
    ServerCommandPolicyTemplateController,
  ],
  providers: [
    ServerExecutorService,
    ServerCommandPolicyService,
    ScriptPlanServerExecutorAdapter,
    SshLiveServerExecutorAdapter,
  ],
  exports: [ServerExecutorService],
})
export class ServerExecutorModule {}
