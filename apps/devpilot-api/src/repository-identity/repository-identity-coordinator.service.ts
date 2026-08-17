import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RepositoryIdentityTransaction } from "./repository-identity.types";
import { lockWritableProject } from "../project/project-writable-lock.repository";

@Injectable()
export class RepositoryIdentityCoordinatorService {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(
    teamId: string,
    projectId: string,
    handler: (tx: RepositoryIdentityTransaction) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockWritableProject(tx, teamId, projectId);
        return handler(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
