import { Module } from '@nestjs/common';
import { CDNService } from './cdn.service';
import { CDNController } from './cdn.controller';
import { ControlAccessPolicyModule } from '../control-access-policy';

@Module({
  imports: [ControlAccessPolicyModule],
  controllers: [CDNController],
  providers: [CDNService],
  exports: [CDNService],
})
export class CDNModule {}
