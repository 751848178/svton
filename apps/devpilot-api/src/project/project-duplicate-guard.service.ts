import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeProjectRepositoryIdentity } from './project-repository-identity.utils';

@Injectable()
export class ProjectDuplicateGuardService {
  constructor(private readonly prisma: PrismaService) {}

  async assertNoDuplicateRepository(teamId: string, repositoryUrl?: string | null) {
    const normalized = normalizeProjectRepositoryIdentity(repositoryUrl);
    if (!normalized) return;

    const projects = await this.prisma.project.findMany({
      where: {
        teamId,
        gitRepo: { not: null },
      },
      select: {
        id: true,
        name: true,
        gitRepo: true,
      },
    });
    const existing = projects.find((project) => normalizeProjectRepositoryIdentity(project.gitRepo) === normalized);
    if (!existing) return;

    throw new ConflictException({
      message: `该仓库已纳管到项目 ${existing.name}`,
      existingProjectId: existing.id,
      existingProjectName: existing.name,
    });
  }
}
