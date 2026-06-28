import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LogCollectionIngestionService } from './log-collection-ingestion.service';

@Module({
  imports: [PrismaModule],
  providers: [LogCollectionIngestionService],
  exports: [LogCollectionIngestionService],
})
export class LogIngestionModule {}
