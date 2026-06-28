import { Module } from '@nestjs/common';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { PrismaModule } from '../prisma/prisma.module';
import { TeamModule } from '../team/team.module';
import { KeyCenterController } from './key-center.controller';
import { KeyCenterService } from './key-center.service';

@Module({
  imports: [PrismaModule, TeamModule, ControlAccessPolicyModule],
  controllers: [KeyCenterController],
  providers: [KeyCenterService],
  exports: [KeyCenterService],
})
export class KeyCenterModule {}
