import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RepositoryIdentityCoordinatorService } from "./repository-identity-coordinator.service";
import { RepositoryIdentityConnectionRepository } from "./repository-identity-connection.repository";
import { RepositoryIdentityFinalizerService } from "./repository-identity-finalizer.service";
import { RepositoryIdentityReadRepository } from "./repository-identity-read.repository";
import { RepositoryIdentityRevisionRepository } from "./repository-identity-revision.repository";

@Module({
  imports: [PrismaModule],
  providers: [
    RepositoryIdentityCoordinatorService,
    RepositoryIdentityConnectionRepository,
    RepositoryIdentityFinalizerService,
    RepositoryIdentityReadRepository,
    RepositoryIdentityRevisionRepository,
  ],
  exports: [
    RepositoryIdentityCoordinatorService,
    RepositoryIdentityConnectionRepository,
    RepositoryIdentityFinalizerService,
    RepositoryIdentityReadRepository,
    RepositoryIdentityRevisionRepository,
  ],
})
export class RepositoryIdentityModule {}
