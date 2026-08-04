import { BadRequestException } from '@nestjs/common';
import type { ApplyRepositorySuggestionsDto } from '../repository-analysis/dto/repository-analysis.dto';
import type { RepositoryIntakeRunRecord } from './repository-intake-contract.repository';
import type {
  RepositoryIntakeOverridesDto,
  ReviewRepositoryIntakeContractDto,
} from './dto/repository-intake-review.dto';

const OVERVIEW_FIELDS = ['projectType', 'architecture', 'packageManager', 'deploymentPlan'];
const COMPONENT_FIELDS = ['name', 'path', 'type', 'buildOutput', 'runMethod'];

export function normalizeRepositoryIntakeReview(
  run: RepositoryIntakeRunRecord,
  dto: ReviewRepositoryIntakeContractDto,
): ApplyRepositorySuggestionsDto {
  const byId = new Map(dto.items.map((item) => [item.suggestionId, item]));
  if (byId.size !== dto.items.length || byId.size !== run.suggestions.length
    || run.suggestions.some((item) => !byId.has(item.id))) {
    fail('REPOSITORY_INTAKE_REVIEW_INCOMPLETE', '必须逐项确认全部识别结果',
      '请接受、编辑或拒绝每一项后重试。');
  }
  const decisions = run.suggestions.map((suggestion) => {
    const item = byId.get(suggestion.id)!;
    validateDecision(suggestion.kind, item.decision, item.overrides);
    if (item.decision !== 'edit') {
      return { suggestionId: suggestion.id, decision: item.decision };
    }
    return {
      suggestionId: suggestion.id,
      decision: 'edit' as const,
      value: editValue(suggestion.kind, suggestion.proposedValue, item.overrides!),
    };
  });
  validateDependencies(run, decisions);
  return { decisions };
}

function validateDecision(
  kind: string,
  decision: 'accept' | 'edit' | 'reject',
  overrides?: RepositoryIntakeOverridesDto,
) {
  const keys = Object.keys(overrides || {}).filter((key) => value(overrides, key) !== undefined);
  if (decision !== 'edit' && keys.length) {
    fail('REPOSITORY_INTAKE_OVERRIDE_WITHOUT_EDIT', '只有编辑决定可以提交覆盖字段',
      '清除覆盖值，或把该项决定改为编辑。');
  }
  if (kind === 'project_repository' && decision === 'reject') {
    fail('REPOSITORY_INTAKE_REPOSITORY_REQUIRED', '已验证仓库是创建基线的必选依赖',
      '接受仓库识别，或返回第一步重新连接仓库。', ['project_repository']);
  }
  if (decision !== 'edit') return;
  const allowed = kind === 'project_repository' ? OVERVIEW_FIELDS
    : kind === 'application_service' ? COMPONENT_FIELDS : [];
  if (!keys.length || keys.some((key) => !allowed.includes(key))) {
    fail('REPOSITORY_INTAKE_EDIT_FIELDS_INVALID', '该识别项包含不允许编辑的字段',
      '只编辑页面标出的项目概况或组件字段。');
  }
}

function validateDependencies(
  run: RepositoryIntakeRunRecord,
  decisions: ApplyRepositorySuggestionsDto['decisions'],
) {
  const byId = new Map(decisions.map((item) => [item.suggestionId, item.decision]));
  const environment = run.suggestions.find((item) => item.kind === 'environment');
  const acceptedComponents = run.suggestions.filter((item) =>
    item.kind === 'application_service' && byId.get(item.id) !== 'reject');
  if (environment && byId.get(environment.id) === 'reject' && acceptedComponents.length) {
    fail('REPOSITORY_INTAKE_DEPENDENCY_BLOCKED', '已接受的组件需要 Production 环境依赖',
      '接受环境依赖，或拒绝依赖它的全部组件。', acceptedComponents.map((item) => item.id));
  }
}

function editValue(
  kind: string,
  proposed: unknown,
  overrides: RepositoryIntakeOverridesDto,
): Record<string, unknown> {
  const next = cloneRecord(proposed);
  if (kind === 'project_repository') {
    const intake = record(next.intakeContract);
    next.intakeContract = {
      ...intake,
      overview: { ...record(intake.overview), ...pick(overrides, OVERVIEW_FIELDS) },
    };
    return next;
  }
  const metadata = record(next.metadata);
  const analysis = record(metadata.repositoryAnalysis);
  next.metadata = {
    ...metadata,
    repositoryAnalysis: {
      ...analysis,
      intakeContract: { ...record(analysis.intakeContract), ...pick(overrides, COMPONENT_FIELDS) },
    },
  };
  if (overrides.name) {
    next.applicationName = overrides.name;
    next.serviceName = overrides.name;
  }
  if (overrides.path) {
    next.repoPath = overrides.path;
    next.deployConfig = { ...record(next.deployConfig), workingDirectory: overrides.path };
  }
  return next;
}

function pick(valueObject: RepositoryIntakeOverridesDto, keys: string[]) {
  return Object.fromEntries(keys.flatMap((key) => {
    const item = value(valueObject, key);
    return item === undefined ? [] : [[key, item]];
  }));
}
function value(object: RepositoryIntakeOverridesDto | undefined, key: string) {
  return object?.[key as keyof RepositoryIntakeOverridesDto];
}
function cloneRecord(valueObject: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record(valueObject))) as Record<string, unknown>;
}
function record(valueObject: unknown): Record<string, unknown> {
  return valueObject && typeof valueObject === 'object' && !Array.isArray(valueObject)
    ? valueObject as Record<string, unknown> : {};
}
function fail(code: string, message: string, action: string, blockers: string[] = []): never {
  throw new BadRequestException({ code, message, action, blockers });
}
