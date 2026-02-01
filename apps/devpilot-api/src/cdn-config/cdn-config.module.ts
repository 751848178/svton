import { Module } from '@nestjs/common';
import { CDNConfigService } from './cdn-config.service';
import { CDNConfigController, TeamCredentialController } from './cdn-config.controller';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [TeamModule],
  controllers: [CDNConfigController, TeamCredentialController],
  providers: [CDNConfigService],
  exports: [CDNConfigService],
})
export class CDNConfigModule {}
