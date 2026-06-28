import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ResourceAuditLogsController,
  ResourceInstancesController,
  ResourceRequestsController,
  ResourceTypeController,
} from './resource-request.controller';
import { ResourceRequestService } from './resource-request.service';

@Module({
  imports: [PrismaModule, ControlAccessPolicyModule],
  controllers: [
    ResourceTypeController,
    ResourceRequestsController,
    ResourceInstancesController,
    ResourceAuditLogsController,
  ],
  providers: [ResourceRequestService],
  exports: [ResourceRequestService],
})
export class ResourceRequestModule {}
