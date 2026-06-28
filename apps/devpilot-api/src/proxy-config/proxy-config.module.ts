import { Module } from '@nestjs/common';
import { ProxyConfigService } from './proxy-config.service';
import { ProxyConfigController } from './proxy-config.controller';
import { TeamModule } from '../team/team.module';
import { ControlAccessPolicyModule } from '../control-access-policy';

@Module({
  imports: [TeamModule, ControlAccessPolicyModule],
  controllers: [ProxyConfigController],
  providers: [ProxyConfigService],
  exports: [ProxyConfigService],
})
export class ProxyConfigModule {}
