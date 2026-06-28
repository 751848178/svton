import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { ResourceController } from './resource.controller';
import { ResourceService } from './resource.service';

@Module({
  imports: [ControlAccessPolicyModule],
  controllers: [ResourceController],
  providers: [ResourceService],
  exports: [ResourceService],
})
export class ResourceModule {}
