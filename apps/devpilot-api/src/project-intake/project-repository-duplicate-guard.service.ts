import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { duplicateRepositoryError } from "./project-intake-errors.utils";
import { normalizeRepositoryIdentity } from "./project-repository-identity.utils";

@Injectable()
export class ProjectRepositoryDuplicateGuardService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAvailable(
    teamId: string,
    projectId: string,
    repositoryUrl: string,
  ): Promise<void> {
    const normalized = normalizeRepositoryIdentity(repositoryUrl);
    if (!normalized) return;
    const finalized = await this.prisma.projectRepositoryIdentity.findFirst({
      where: {
        teamId,
        canonicalKey: normalized.canonicalKey,
        projectId: { not: projectId },
      },
      select: { id: true },
    });
    if (finalized) throw duplicateRepositoryError();

    const connections = await this.prisma.repositoryConnection.findMany({
      where: { teamId, projectId: { not: projectId } },
      select: { repositoryUrl: true },
    });
    const duplicate = connections.some(
      (connection) =>
        normalizeRepositoryIdentity(connection.repositoryUrl)?.canonicalKey ===
        normalized.canonicalKey,
    );
    if (duplicate) throw duplicateRepositoryError();
  }
}
