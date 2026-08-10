import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RepositoryAppliedReference,
} from './repository-apply.types';
import { RepositoryApplicationApplyRepository } from './repository-application-apply.repository';
import {
  json,
  numberValue,
  record,
  stringArray,
  stringValue,
} from './repository-platform-apply.utils';

@Injectable()
export class RepositoryPlatformApplyRepository {
  constructor(private readonly applications: RepositoryApplicationApplyRepository) {}

  async applyProject(
    tx: Prisma.TransactionClient,
    projectId: string,
    runId: string,
    value: Record<string, unknown>,
  ): Promise<RepositoryAppliedReference> {
    const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    const current = record(project.config);
    const source = record(value.source);
    await tx.project.update({
      where: { id: projectId },
      data: {
        gitRepo: stringValue(value.gitRepo) || project.gitRepo,
        config: json({
          ...current,
          source: { ...record(current.source), ...source },
          onboarding: {
            ...record(current.onboarding),
            repositoryVerification: 'verified',
            repositoryAnalysis: 'applied',
          },
          repositoryAnalysis: {
            ...record(current.repositoryAnalysis),
            lastAppliedRunId: runId,
            verifiedAt: new Date().toISOString(),
            intakeContract: record(value.intakeContract),
          },
        }),
      },
    });
    return {
      suggestionId: '',
      kind: 'project_repository',
      projectId,
      links: [{ label: '项目概览', href: `/projects/${projectId}?tab=overview` }],
    };
  }

  async applyEnvironment(
    tx: Prisma.TransactionClient,
    teamId: string,
    projectId: string,
    value: Record<string, unknown>,
  ): Promise<RepositoryAppliedReference> {
    const key = stringValue(value.key) || 'production';
    const environment = await tx.projectEnvironment.upsert({
      where: { projectId_key: { projectId, key } },
      create: {
        teamId,
        projectId,
        key,
        name: stringValue(value.name) || key,
        status: 'active',
        sortOrder: numberValue(value.sortOrder) ?? 30,
      },
      update: {},
    });
    return {
      suggestionId: '',
      kind: 'environment',
      projectId,
      environmentId: environment.id,
      links: [{
        label: '项目环境',
        href: `/projects/${projectId}?tab=environments&environmentId=${environment.id}`,
      }],
    };
  }

  async applyApplicationService(
    tx: Prisma.TransactionClient,
    teamId: string,
    projectId: string,
    runId: string,
    value: Record<string, unknown>,
  ): Promise<RepositoryAppliedReference> {
    return this.applications.apply(tx, teamId, projectId, runId, value);
  }

  async applyResourceRequirements(
    tx: Prisma.TransactionClient,
    projectId: string,
    value: Record<string, unknown>,
  ): Promise<RepositoryAppliedReference> {
    const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    const current = record(project.config);
    await tx.project.update({
      where: { id: projectId },
      data: {
        config: json({
          ...current,
          repositoryAnalysis: {
            ...record(current.repositoryAnalysis),
            resourceRequirements: stringArray(value.requirements),
          },
        }),
      },
    });
    return {
      suggestionId: '',
      kind: 'resource_requirement',
      projectId,
      links: [{ label: '资源管控', href: `/projects/${projectId}?tab=resources` }],
    };
  }
}
