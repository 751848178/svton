import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RepositoryIdentityTransaction } from "./repository-identity.types";

@Injectable()
export class RepositoryIdentityCoordinatorService {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(
    teamId: string,
    projectId: string,
    handler: (tx: RepositoryIdentityTransaction) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM Project
        WHERE id = ${projectId} AND teamId = ${teamId}
        FOR UPDATE
      `;
      if (rows.length !== 1) throw new NotFoundException("项目不存在或不属于当前团队");
      return handler(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
