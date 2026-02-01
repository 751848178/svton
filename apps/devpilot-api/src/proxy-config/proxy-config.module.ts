import { Module } from '@nestjs/common';
import { ProxyConfigService } from './proxy-config.service';
import { ProxyConfigController } from './proxy-config.controller';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [TeamModule],
  controllers: [ProxyConfigController],
  providers: [ProxyConfigService],
  exports: [ProxyConfigService],
})
export class ProxyConfigModule {}
