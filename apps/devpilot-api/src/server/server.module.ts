import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { TeamModule } from '../team/team.module';
import { ServerService } from './server.service';
import { ServerController } from './server.controller';
import { ServerConnectionCapabilityService } from './server-connection-capability.service';

@Module({
  imports: [TeamModule, ControlAccessPolicyModule],
  controllers: [ServerController],
  providers: [ServerService, ServerConnectionCapabilityService],
  exports: [ServerService, ServerConnectionCapabilityService],
})
export class ServerModule {}
