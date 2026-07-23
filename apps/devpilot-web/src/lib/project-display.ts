export type ProjectOrigin = 'generated' | 'imported' | 'external';
export type ProjectManagementScope = 'full' | 'deployment' | 'resources';

export type ProjectConfigRecord = Record<string, unknown>;

const originLabels: Record<ProjectOrigin, string> = {
  generated: '生成项目',
  imported: '已有项目',
  external: '外部项目',
};

const managementScopeLabels: Record<ProjectManagementScope, string> = {
  full: '完整纳管',
  deployment: '仅构建部署',
  resources: '资源归属',
};

const subProjectLabels: Record<string, string> = {
  backend: 'Backend',
  admin: 'Admin',
  mobile: 'Mobile',
};

/** 子项目 key 无法识别时的中性兜底文案，避免把内部原始 key 作为标签直接暴露。 */
const UNKNOWN_SUBPROJECT_LABEL = '其他子项目';

function isRecord(value: unknown): value is ProjectConfigRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readEnabledKeys(value: unknown): string[] {
  if (!isRecord(value)) return [];

  return Object.entries(value)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => subProjectLabels[key] ?? UNKNOWN_SUBPROJECT_LABEL);
}

export function toProjectConfigRecord(config: unknown): ProjectConfigRecord {
  return isRecord(config) ? config : {};
}

export function getProjectOrigin(config: unknown): ProjectOrigin {
  const record = toProjectConfigRecord(config);
  const rawOrigin = record.origin ?? record.mode;

  if (rawOrigin === 'generated' || rawOrigin === 'imported' || rawOrigin === 'external') {
    return rawOrigin;
  }

  return isRecord(record.basicInfo) || isRecord(record.subProjects) ? 'generated' : 'imported';
}

export function getProjectOriginLabel(config: unknown): string {
  return originLabels[getProjectOrigin(config)];
}

export function getProjectDescription(config: unknown, fallback?: string | null): string {
  const record = toProjectConfigRecord(config);
  const basicInfo = isRecord(record.basicInfo) ? record.basicInfo : undefined;

  return (
    readString(record.description) ??
    readString(basicInfo?.description) ??
    readString(fallback) ??
    ''
  );
}

export function getProjectRepository(config: unknown, fallback?: string | null): string {
  const record = toProjectConfigRecord(config);
  const source = isRecord(record.source) ? record.source : undefined;

  return readString(fallback) ?? readString(source?.repository) ?? '';
}

export function getProjectBranch(config: unknown): string {
  const record = toProjectConfigRecord(config);
  const source = isRecord(record.source) ? record.source : undefined;

  return readString(source?.branch) ?? '';
}

export function getProjectEnvironmentLabels(config: unknown): string[] {
  const record = toProjectConfigRecord(config);
  const values = readStringArray(record.environments);

  return values.map((env) => {
    if (env === 'dev') return '开发';
    if (env === 'test') return '测试';
    if (env === 'staging') return '预发';
    if (env === 'prod') return '生产';
    return env;
  });
}

export function getProjectManagementScope(config: unknown): ProjectManagementScope {
  const record = toProjectConfigRecord(config);
  const onboarding = isRecord(record.onboarding) ? record.onboarding : undefined;
  const rawScope = record.managementScope ?? onboarding?.scope;

  if (rawScope === 'full' || rawScope === 'deployment' || rawScope === 'resources') {
    return rawScope;
  }

  const origin = getProjectOrigin(record);
  if (origin === 'generated') return 'full';
  if (origin === 'external') return 'resources';

  return 'full';
}

export function getProjectManagementScopeLabel(config: unknown): string {
  return managementScopeLabels[getProjectManagementScope(config)];
}

export function getProjectSubProjectLabels(config: unknown): string[] {
  const record = toProjectConfigRecord(config);
  const subProjects = record.subProjects;

  if (Array.isArray(subProjects)) {
    return readStringArray(subProjects).map((key) => subProjectLabels[key] ?? UNKNOWN_SUBPROJECT_LABEL);
  }

  return readEnabledKeys(subProjects);
}

export function getProjectStackTags(config: unknown): string[] {
  const record = toProjectConfigRecord(config);
  const basicInfo = isRecord(record.basicInfo) ? record.basicInfo : undefined;
  const stackProfile = isRecord(record.stackProfile) ? record.stackProfile : undefined;
  const tags = [
    readString(stackProfile?.language),
    readString(stackProfile?.framework),
    readString(stackProfile?.packageManager) ?? readString(basicInfo?.packageManager),
  ];

  return [...new Set(tags.filter((tag): tag is string => Boolean(tag)))];
}

export function getProjectDeploymentConfig(config: unknown) {
  const record = toProjectConfigRecord(config);
  const deployment = isRecord(record.deployment) ? record.deployment : undefined;
  const stackProfile = isRecord(record.stackProfile) ? record.stackProfile : undefined;

  return {
    targetType: readString(deployment?.targetType) ?? '',
    workingDirectory: readString(deployment?.workingDirectory) ?? '',
    buildCommand:
      readString(deployment?.buildCommand) ?? readString(stackProfile?.buildCommand) ?? '',
    deployCommand:
      readString(deployment?.deployCommand) ?? readString(stackProfile?.deployCommand) ?? '',
    healthCheckUrl: readString(deployment?.healthCheckUrl) ?? '',
  };
}

export function isGeneratedProject(config: unknown): boolean {
  return getProjectOrigin(config) === 'generated';
}
