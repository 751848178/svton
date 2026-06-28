import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { MonitoringController } from './monitoring.controller';
import { MonitoringSchedulerService } from './monitoring-scheduler.service';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [PrismaModule, AuditEventModule, ControlAccessPolicyModule],
  controllers: [MonitoringController],
  providers: [MonitoringService, MonitoringSchedulerService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
