import { Module } from '@nestjs/common';
import { ResourcePoolService } from './resource-pool.service';
import { ResourcePoolController } from './resource-pool.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ResourcePoolController],
  providers: [ResourcePoolService],
  exports: [ResourcePoolService],
})
export class ResourcePoolModule {}
