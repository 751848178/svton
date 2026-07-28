import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { TeamModule } from '../team/team.module';
import { ServerService } from './server.service';
import { ServerController } from './server.controller';
import { ServerConnectionCapabilityService } from './server-connection-capability.service';
import { ServerCredentialAccessService } from './server-credential-access.service';

@Module({
  imports: [TeamModule, ControlAccessPolicyModule],
  controllers: [ServerController],
  providers: [ServerService, ServerConnectionCapabilityService, ServerCredentialAccessService],
  exports: [ServerService, ServerConnectionCapabilityService, ServerCredentialAccessService],
})
export class ServerModule {}
