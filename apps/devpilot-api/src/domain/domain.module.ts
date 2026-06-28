import { Module } from '@nestjs/common';
import { DomainService } from './domain.service';
import { DomainController } from './domain.controller';
import { ControlAccessPolicyModule } from '../control-access-policy';

@Module({
  imports: [ControlAccessPolicyModule],
  controllers: [DomainController],
  providers: [DomainService],
  exports: [DomainService],
})
export class DomainModule {}
