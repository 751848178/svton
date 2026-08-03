import { Module } from "@nestjs/common";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectDirectoryController } from "./project-directory.controller";
import { ProjectDirectoryRepository } from "./project-directory.repository";
import { ProjectDirectoryService } from "./project-directory.service";

@Module({
  imports: [PrismaModule, ControlAccessPolicyModule],
  controllers: [ProjectDirectoryController],
  providers: [ProjectDirectoryService, ProjectDirectoryRepository],
  exports: [ProjectDirectoryService],
})
export class ProjectDirectoryModule {}
