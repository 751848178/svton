import { forwardRef, Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event';
import { PrismaModule } from '../prisma/prisma.module';
import { ControlAccessPolicyController } from './control-access-policy.controller';
import { ControlAccessPolicyService } from './control-access-policy.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AuditEventModule)],
  controllers: [ControlAccessPolicyController],
  providers: [ControlAccessPolicyService],
  exports: [ControlAccessPolicyService],
})
export class ControlAccessPolicyModule {}
