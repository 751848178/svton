import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { repositoryError } from './repository-analysis-validation.utils';

export interface SaveRepositoryConnectionInput {
  teamId: string;
  projectId: string;
  userId: string;
  repositoryUrl: string;
  provider: string;
  visibility: string;
  credentialSource: string;
  gitConnectionId?: string;
  teamCredentialId?: string;
  defaultBranch?: string;
  selectedBranch?: string;
  commitSha?: string;
  branches?: string[];
  status: 'connected' | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class RepositoryConnectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertProject(teamId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true, gitRepo: true, config: true },
    });
    if (!project) throw new NotFoundException(repositoryError(
      'PROJECT_NOT_FOUND',
      '项目不存在',
      '请返回项目列表并重新选择。',
    ));
    return project;
  }

  findByProject(teamId: string, projectId: string) {
    return this.prisma.repositoryConnection.findFirst({
      where: { teamId, projectId },
    });
  }

  async hasActiveRun(teamId: string, projectId: string): Promise<boolean> {
    return (await this.prisma.repositoryAnalysisRun.count({
      where: { teamId, projectId, status: { in: ['queued', 'running'] } },
    })) > 0;
  }

  async save(input: SaveRepositoryConnectionInput) {
    const existing = await this.findByProject(input.teamId, input.projectId);
    const sameSnapshot = existing?.repositoryUrl === input.repositoryUrl
      && existing.selectedBranch === input.selectedBranch
      && existing.commitSha === input.commitSha;
    const data: Prisma.RepositoryConnectionUncheckedCreateInput = {
      teamId: input.teamId,
      projectId: input.projectId,
      connectedById: input.userId,
      repositoryUrl: input.repositoryUrl,
      provider: input.provider,
      visibility: input.visibility,
      credentialSource: input.credentialSource,
      gitConnectionId: input.gitConnectionId ?? null,
      teamCredentialId: input.teamCredentialId ?? null,
      defaultBranch: input.defaultBranch ?? null,
      selectedBranch: input.selectedBranch ?? null,
      commitSha: input.commitSha ?? null,
      branches: input.branches ? input.branches : Prisma.JsonNull,
      status: input.status,
      verifiedAt: input.status === 'connected' ? new Date() : null,
      lastAppliedRunId: sameSnapshot ? existing?.lastAppliedRunId : null,
      appliedAt: sameSnapshot ? existing?.appliedAt : null,
      errorCode: input.status === 'connected' ? null : input.errorCode ?? null,
      errorMessage: input.status === 'connected' ? null : input.errorMessage ?? null,
    };
    return this.prisma.repositoryConnection.upsert({
      where: { projectId: input.projectId },
      create: data,
      update: data,
    });
  }

  markApplied(connectionId: string, runId: string, appliedAt: Date, tx?: Prisma.TransactionClient) {
    return (tx || this.prisma).repositoryConnection.update({
      where: { id: connectionId },
      data: { lastAppliedRunId: runId, appliedAt },
    });
  }
}
