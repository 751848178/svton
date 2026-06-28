import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { ServerExecutorModule } from '../server-executor/server-executor.module';
import { AliyunSlsLogQueryAdapter } from './aliyun-sls-log-query.adapter';
import { LogCenterController } from './log-center.controller';
import { LogCenterService } from './log-center.service';
import { LogIngestionModule } from './log-ingestion.module';
import { LogRetentionSchedulerService } from './log-retention-scheduler.service';
import { LogServerFollowSchedulerService } from './log-server-follow-scheduler.service';
import { LogSlsBackfillSchedulerService } from './log-sls-backfill-scheduler.service';
import { LogStreamSessionRegistry } from './log-stream-session.registry';

@Module({
  imports: [PrismaModule, AuditEventModule, ServerExecutorModule, ControlAccessPolicyModule, LogIngestionModule],
  controllers: [LogCenterController],
  providers: [
    LogCenterService,
    LogRetentionSchedulerService,
    LogServerFollowSchedulerService,
    LogSlsBackfillSchedulerService,
    AliyunSlsLogQueryAdapter,
    LogStreamSessionRegistry,
  ],
  exports: [LogCenterService],
})
export class LogCenterModule {}
