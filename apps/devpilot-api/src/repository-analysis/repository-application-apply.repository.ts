import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RepositoryAppliedReference } from './repository-apply.types';
import {
  optionalJson,
  resolveEnvironmentId,
  safeKind,
  stringValue,
} from './repository-platform-apply.utils';
import { mergeRepositoryDeployConfig } from './repository-deploy-config-merge.utils';

@Injectable()
export class RepositoryApplicationApplyRepository {
  async apply(
    tx: Prisma.TransactionClient,
    teamId: string,
    projectId: string,
    runId: string,
    value: Record<string, unknown>,
  ): Promise<RepositoryAppliedReference> {
    const environmentId = await resolveEnvironmentId(tx, projectId, value);
    const application = await this.resolveApplication(
      tx,
      teamId,
      projectId,
      runId,
      value,
    );
    const service = await this.resolveService(
      tx,
      teamId,
      projectId,
      application.id,
      environmentId,
      value,
    );
    return {
      suggestionId: '',
      kind: 'application_service',
      projectId,
      environmentId,
      applicationId: application.id,
      applicationServiceId: service.id,
      links: [
        {
          label: '应用服务',
          href: `/applications?projectId=${projectId}&applicationId=${application.id}&serviceId=${service.id}`,
        },
        {
          label: '服务监控',
          href: `/monitoring?applicationServiceId=${service.id}`,
        },
      ],
    };
  }

  private async resolveApplication(
    tx: Prisma.TransactionClient,
    teamId: string,
    projectId: string,
    runId: string,
    value: Record<string, unknown>,
  ) {
    const id = stringValue(value.applicationId);
    const name = stringValue(value.applicationName) || stringValue(value.serviceName);
    if (!name) throw new Error('applicationName is required');
    const data = {
      description: stringValue(value.applicationDescription),
      repositoryUrl: stringValue(value.repositoryUrl),
      repoPath: stringValue(value.repoPath),
      defaultBranch: stringValue(value.defaultBranch),
    };
    if (id) {
      const existing = await tx.application.findFirst({ where: { id, projectId } });
      if (!existing) throw new Error('application scope mismatch');
      return tx.application.update({ where: { id }, data });
    }
    return tx.application.upsert({
      where: { projectId_name: { projectId, name } },
      create: {
        teamId,
        projectId,
        name,
        ...data,
        config: { repositoryAnalysisRunId: runId },
      },
      update: data,
    });
  }

  private async resolveService(
    tx: Prisma.TransactionClient,
    teamId: string,
    projectId: string,
    applicationId: string,
    environmentId: string,
    value: Record<string, unknown>,
  ) {
    const id = stringValue(value.serviceId);
    const name = stringValue(value.serviceName) || stringValue(value.applicationName);
    if (!name) throw new Error('serviceName is required');
    const baseData = {
      kind: safeKind(value.kind),
      runtime: stringValue(value.runtime),
      ports: optionalJson(value.ports),
      metadata: optionalJson(value.metadata),
    };
    if (id) {
      const existing = await tx.applicationService.findFirst({
        where: { id, projectId, applicationId },
      });
      if (!existing) throw new Error('application service scope mismatch');
      return tx.applicationService.update({
        where: { id },
        data: {
          ...baseData,
          deployConfig: mergeRepositoryDeployConfig(
            existing.deployConfig,
            value.deployConfig,
          ),
        },
      });
    }
    const unique = { applicationId, environmentId, name };
    const existing = await tx.applicationService.findUnique({
      where: { applicationId_environmentId_name: unique },
    });
    const data = {
      ...baseData,
      deployConfig: mergeRepositoryDeployConfig(
        existing?.deployConfig,
        value.deployConfig,
      ),
    };
    return tx.applicationService.upsert({
      where: { applicationId_environmentId_name: unique },
      create: {
        teamId,
        projectId,
        applicationId,
        environmentId,
        name,
        ...data,
      },
      update: data,
    });
  }
}
