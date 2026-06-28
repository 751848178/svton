import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourcePoolService } from './resource-pool.service';
import { ResourcePoolController } from './resource-pool.controller';

@Module({
  imports: [PrismaModule, ControlAccessPolicyModule],
  controllers: [ResourcePoolController],
  providers: [ResourcePoolService],
  exports: [ResourcePoolService],
})
export class ResourcePoolModule {}
