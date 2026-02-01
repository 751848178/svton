import { Module } from '@nestjs/common';
import { KeyCenterService } from './key-center.service';
import { KeyCenterController } from './key-center.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [PrismaModule, TeamModule],
  controllers: [KeyCenterController],
  providers: [KeyCenterService],
  exports: [KeyCenterService],
})
export class KeyCenterModule {}
