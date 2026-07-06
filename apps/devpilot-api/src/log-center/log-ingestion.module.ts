import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LogCollectionIngestionRepository } from "./log-collection-ingestion.repository";
import { LogCollectionIngestionService } from "./log-collection-ingestion.service";

@Module({
  imports: [PrismaModule],
  providers: [LogCollectionIngestionRepository, LogCollectionIngestionService],
  exports: [LogCollectionIngestionService],
})
export class LogIngestionModule {}
