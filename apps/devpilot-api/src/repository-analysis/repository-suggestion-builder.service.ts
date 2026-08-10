import { Injectable, NotFoundException } from '@nestjs/common';
import { RepositoryAnalysisRun } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { repositoryError } from './repository-analysis-validation.utils';
import { secureRepositoryCommands } from './repository-command-security.utils';
import {
  detectIntakeComponent,
  detectIntakeOverview,
} from './repository-intake-detection.utils';
import {
  DetectedService,
  RepositoryAnalysisResult,
  RepositorySuggestionDraft,
} from './repository-parser.types';
import {
  ExistingRepositoryApplication,
  findRepositoryApplication,
  findRepositoryService,
} from './repository-suggestion-match.utils';

@Injectable()
export class RepositorySuggestionBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    teamId: string,
    projectId: string,
    run: RepositoryAnalysisRun,
    result: RepositoryAnalysisResult,
  ): Promise<RepositorySuggestionDraft[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      include: {
        environments: { where: { status: 'active' }, orderBy: { sortOrder: 'asc' } },
        applications: { include: { services: true } },
      },
    });
    if (!project) throw new NotFoundException(repositoryError(
      'PROJECT_NOT_FOUND',
      '项目不存在',
      '请返回项目列表并重新选择。',
    ));
    const drafts: RepositorySuggestionDraft[] = [];
    const projectConfig = asRecord(project.config);
    const repositoryUrl = isLocal(run.repositoryUrl) && project.gitRepo
      ? project.gitRepo
      : run.repositoryUrl;
    drafts.push({
      key: 'project_repository',
      kind: 'project_repository',
      confidence: 'high',
      conflict: Boolean(project.gitRepo && project.gitRepo !== repositoryUrl),
      impact: '把手工仓库来源更新为已验证的分支和精确 commit，并保留解析证据。',
      currentValue: {
        gitRepo: project.gitRepo,
        source: projectConfig.source,
      },
      proposedValue: {
        gitRepo: repositoryUrl,
        source: {
          type: 'git',
          repository: repositoryUrl,
          branch: run.branch,
          commitSha: run.commitSha,
          verified: true,
          analysisRunId: run.id,
        },
        intakeContract: { version: 1, overview: detectIntakeOverview(result) },
      },
      evidence: [{
        file: '.git',
        kind: 'git_snapshot',
        detail: `${run.branch}@${run.commitSha}`,
        confidence: 'high',
      }],
      warnings: [],
    });
    const environment = project.environments[0];
    if (!environment) drafts.push(environmentDraft());
    for (const service of result.services.filter((item) => item.deployable || item.artifactOnly)) {
      drafts.push(serviceDraft(
        service,
        run,
        repositoryUrl,
        environment?.id,
        project.applications,
      ));
    }
    if (result.resourceRequirements.length > 0) {
      const current = asRecord(projectConfig.repositoryAnalysis).resourceRequirements;
      drafts.push({
        key: 'resource_requirements',
        kind: 'resource_requirement',
        confidence: 'medium',
        conflict: Array.isArray(current) && current.length > 0,
        impact: '记录需要人工确认或申请的外部资源，不会自动供应资源。',
        currentValue: current,
        proposedValue: { requirements: result.resourceRequirements },
        evidence: result.services.flatMap((service) => service.evidence).slice(0, 20),
        warnings: ['应用此建议只记录需求，不会创建或修改真实数据库、Redis 或对象存储。'],
      });
    }
    return drafts;
  }
}
function environmentDraft(): RepositorySuggestionDraft {
  return {
    key: 'environment:production',
    kind: 'environment',
    confidence: 'medium',
    conflict: false,
    impact: '为解析出的服务创建一个默认生产环境骨架。',
    proposedValue: { key: 'production', name: '生产', status: 'active', sortOrder: 30 },
    evidence: [],
    warnings: ['项目没有可用环境；环境名称和用途必须在应用前确认。'],
  };
}
function serviceDraft(
  detected: DetectedService,
  run: RepositoryAnalysisRun,
  repositoryUrl: string,
  environmentId: string | undefined,
  applications: ExistingRepositoryApplication[],
): RepositorySuggestionDraft {
  const application = findRepositoryApplication(applications, detected, repositoryUrl);
  const currentService = findRepositoryService(application, detected, environmentId);
  const secured = secureRepositoryCommands(detected.commands);
  const deployConfig = compact({
    targetType: detected.container.composeFiles.length > 0 ? 'docker-compose' : 'server',
    workingDirectory: detected.path,
    buildCommand: secured.commands.build,
    artifactPaths: detected.artifacts,
    deployCommand: secured.commands.start,
    migrationCommand: secured.commands.migrate,
    initializationCommand: secured.commands.bootstrap,
    seedCommand: secured.commands.seed,
    backfillCommand: secured.commands.backfill,
    healthCheckPath: detected.healthChecks[0]?.path,
    dockerfile: detected.container.dockerfile,
    dockerBuildContext: detected.container.buildContext,
    composeFiles: detected.container.composeFiles,
  });
  const proposedValue = {
    applicationId: application?.id,
    applicationName: application?.name || detected.name,
    applicationDescription: application
      ? undefined
      : `${detected.role} · 来自仓库解析`,
    repositoryUrl,
    defaultBranch: run.branch,
    repoPath: application ? application.repoPath || undefined : detected.path,
    environmentId,
    environmentKey: environmentId ? undefined : 'production',
    serviceId: currentService?.id,
    serviceName: currentService?.name || detected.name,
    kind: detected.container.composeFiles.length > 0 ? 'docker-compose' : 'container',
    runtime: detected.runtime,
    ports: detected.ports,
    deployConfig,
    metadata: {
      repositoryAnalysis: {
        runId: run.id,
        commitSha: run.commitSha,
        role: detected.role,
        frameworks: detected.framework,
        environment: detected.environment,
        healthChecks: detected.healthChecks,
        artifacts: detected.artifacts,
        intakeContract: detectIntakeComponent(detected),
      },
    },
  };
  return {
    key: `application_service:${detected.key}`,
    kind: 'application_service',
    confidence: detected.warnings.length ? 'medium' : 'high',
    conflict: Boolean(currentService && !same(currentService.deployConfig, deployConfig)),
    impact: `${application ? '关联' : '创建'}应用和环境服务，并写入构建、启动、端口与发布阶段建议。`,
    currentValue: currentService
      ? { applicationId: application?.id, serviceId: currentService.id, ...currentService }
      : application ? { applicationId: application.id, serviceId: null } : undefined,
    proposedValue: compact(proposedValue),
    evidence: detected.evidence,
    warnings: [...detected.warnings, ...secured.warnings],
  };
}
function compact<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
function isLocal(repositoryUrl: string): boolean {
  return repositoryUrl.startsWith('/') || repositoryUrl.startsWith('file://');
}
