import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { TeamModule } from '../team/team.module';
import { ServerService } from './server.service';
import { ServerController } from './server.controller';

@Module({
  imports: [TeamModule, ControlAccessPolicyModule],
  controllers: [ServerController],
  providers: [ServerService],
  exports: [ServerService],
})
export class ServerModule {}
