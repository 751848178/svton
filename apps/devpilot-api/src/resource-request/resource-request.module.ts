import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  ResourceAuditLogsController,
  ResourceInstancesController,
  ResourceRequestsController,
  ResourceTypeController,
} from './resource-request.controller';
import { ResourceRequestService } from './resource-request.service';

@Module({
  imports: [PrismaModule],
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
