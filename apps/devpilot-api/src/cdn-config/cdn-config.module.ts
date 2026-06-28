import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { TeamModule } from '../team/team.module';
import { CDNConfigService } from './cdn-config.service';
import { CDNConfigController, TeamCredentialController } from './cdn-config.controller';

@Module({
  imports: [TeamModule, ControlAccessPolicyModule],
  controllers: [CDNConfigController, TeamCredentialController],
  providers: [CDNConfigService],
  exports: [CDNConfigService],
})
export class CDNConfigModule {}
