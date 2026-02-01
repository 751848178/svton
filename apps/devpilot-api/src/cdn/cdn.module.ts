import { Module } from '@nestjs/common';
import { CDNService } from './cdn.service';
import { CDNController } from './cdn.controller';

@Module({
  controllers: [CDNController],
  providers: [CDNService],
  exports: [CDNService],
})
export class CDNModule {}
