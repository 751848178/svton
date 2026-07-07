import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { OperationApprovalModule } from '../operation-approval';
import { PrismaModule } from '../prisma/prisma.module';
import { ServerExecutorModule } from '../server-executor';
import { SiteController } from './site.controller';
import { SiteTlsProbeSchedulerService } from './site-tls-probe-scheduler.service';
import { SiteTlsRenewSchedulerService } from './site-tls-renew-scheduler.service';
import { SiteService } from './site.service';
import { SitePostSyncUpdateService } from './site-post-sync-update.service';
import { SiteSyncExecutionService } from './site-sync-execution.service';

@Module({
  imports: [
    PrismaModule,
    ServerExecutorModule,
    AuditEventModule,
    OperationApprovalModule,
    ControlAccessPolicyModule,
  ],
  controllers: [SiteController],
  providers: [SiteService, SitePostSyncUpdateService, SiteSyncExecutionService, SiteTlsProbeSchedulerService, SiteTlsRenewSchedulerService],
  exports: [SiteService, SiteTlsProbeSchedulerService, SiteTlsRenewSchedulerService],
})
export class SiteModule {}
