import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { ServerExecutorModule } from '../server-executor';
import { BackupRestoreService } from './backup-restore.service';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [PrismaModule, ServerExecutorModule, AuditEventModule, ControlAccessPolicyModule],
  controllers: [BackupController],
  providers: [BackupService, BackupRestoreService],
  exports: [BackupService, BackupRestoreService],
})
export class BackupModule {}
