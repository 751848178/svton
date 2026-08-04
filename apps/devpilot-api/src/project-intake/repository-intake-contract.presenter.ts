import type {
  RepositoryIntakeComponentValue,
  RepositoryIntakeOverviewValue,
} from '../repository-analysis/repository-intake-contract.types';
import { redactRepositoryValue } from '../repository-analysis/repository-analysis-redact.utils';
import type { RepositoryIntakeRunRecord } from './repository-intake-contract.repository';
import type {
  RepositoryIntakeContractReadModel,
  RepositoryIntakeDecision,
  RepositoryIntakeSnapshotDecision,
  RepositoryIntakeSnapshotReadModel,
  RepositoryIntakeSnapshotReference,
} from './repository-intake-contract.types';

export function presentRepositoryIntakeContract(
  run: RepositoryIntakeRunRecord,
): RepositoryIntakeContractReadModel {
  const projectSuggestion = run.suggestions.find((item) => item.kind === 'project_repository');
  const environment = run.suggestions.find((item) => item.kind === 'environment');
  const components = run.suggestions.filter((item) => item.kind === 'application_service');
  const model: RepositoryIntakeContractReadModel = {
    version: 1,
    run: {
      id: run.id,
      status: run.status,
      parserVersion: run.parserVersion,
      error: run.errorMessage ? {
        code: run.errorCode || undefined,
        message: run.errorMessage,
        action: run.errorAction || '请检查仓库连接后重试。',
      } : undefined,
      retry: {
        allowed: ['failed', 'cancelled'].includes(run.status),
        href: `/project-intake/${run.projectId}/analysis-runs/${run.id}/retry`,
        label: '重试仓库分析',
      },
    },
    repository: {
      provider: run.connection.provider,
      repositoryUrl: run.connection.repositoryUrl,
      visibility: run.connection.visibility,
      managedReference: managedReference(run.connection),
      defaultBranch: run.connection.defaultBranch || run.branch,
      selectedBranch: run.connection.selectedBranch || run.branch,
      commitSha: run.connection.commitSha || run.commitSha,
      verifiedAt: run.connection.verifiedAt?.toISOString() || null,
    },
    overview: projectSuggestion ? {
      suggestionId: projectSuggestion.id,
      required: true,
      decision: decision(projectSuggestion.reviewDecision),
      value: overviewValue(reviewedValue(projectSuggestion)),
    } : null,
    components: components.map((item) => ({
      suggestionId: item.id,
      requiredDependencyIds: environment ? [environment.id] : [],
      decision: decision(item.reviewDecision),
      value: componentValue(reviewedValue(item)),
      warnings: stringArray(item.warnings),
    })),
    dependencies: run.suggestions
      .filter((item) => ['environment', 'resource_requirement'].includes(item.kind))
      .map((item) => ({
        suggestionId: item.id,
        kind: item.kind as 'environment' | 'resource_requirement',
        label: item.kind === 'environment' ? 'Production 环境依赖' : '外部资源需求',
        requiredBy: item.kind === 'environment' ? components.map((value) => value.id) : [],
        decision: decision(item.reviewDecision),
      })),
    snapshot: snapshot(run.intakeReviewSnapshot),
  };
  return redactRepositoryValue(model) as RepositoryIntakeContractReadModel;
}

function reviewedValue(item: RepositoryIntakeRunRecord['suggestions'][number]) {
  return item.reviewedValue || item.proposedValue;
}

function overviewValue(value: unknown): RepositoryIntakeOverviewValue {
  const intake = record(record(value).intakeContract);
  return record(intake.overview) as unknown as RepositoryIntakeOverviewValue;
}

function componentValue(value: unknown): RepositoryIntakeComponentValue {
  const metadata = record(record(value).metadata);
  const analysis = record(metadata.repositoryAnalysis);
  return record(analysis.intakeContract) as unknown as RepositoryIntakeComponentValue;
}

function snapshot(value: RepositoryIntakeRunRecord['intakeReviewSnapshot']): RepositoryIntakeSnapshotReadModel | null {
  if (!value) return null;
  return {
    id: value.id,
    version: value.version,
    hash: value.snapshotHash,
    inputHash: value.inputHash,
    runId: value.runId,
    branch: value.branch,
    commitSha: value.commitSha,
    parserVersion: value.parserVersion,
    actorId: value.actorId,
    decidedAt: value.createdAt.toISOString(),
    decisions: array(value.decisions) as RepositoryIntakeSnapshotDecision[],
    references: array(value.references) as RepositoryIntakeSnapshotReference[],
  };
}

function managedReference(connection: RepositoryIntakeRunRecord['connection']) {
  if (connection.visibility !== 'private') return null;
  const id = connection.teamCredentialId || connection.gitConnectionId;
  return id ? { source: connection.credentialSource, id } : null;
}

function decision(value: string | null): RepositoryIntakeDecision | null {
  return value === 'accept' || value === 'edit' || value === 'reject' ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function stringArray(value: unknown): string[] {
  return array(value).filter((item): item is string => typeof item === 'string');
}
