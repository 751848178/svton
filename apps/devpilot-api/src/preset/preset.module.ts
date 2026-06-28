import { Module } from '@nestjs/common';
import { PresetService } from './preset.service';
import { PresetController } from './preset.controller';
import { TeamModule } from '../team/team.module';
import { ControlAccessPolicyModule } from '../control-access-policy';

@Module({
  imports: [TeamModule, ControlAccessPolicyModule],
  controllers: [PresetController],
  providers: [PresetService],
  exports: [PresetService],
})
export class PresetModule {}
