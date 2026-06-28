import { forwardRef, Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditEventController } from './audit-event.controller';
import { AuditEventService } from './audit-event.service';

@Module({
  imports: [PrismaModule, forwardRef(() => ControlAccessPolicyModule)],
  controllers: [AuditEventController],
  providers: [AuditEventService],
  exports: [AuditEventService],
})
export class AuditEventModule {}
