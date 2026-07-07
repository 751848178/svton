/**
 * Pure step/result builders for the project-environment CDN-config copy service.
 *
 * Owns the per-CDN copy-step shaping (skipped/planned/applied), the create
 * payload, and the final apply-result assembly. Extracted from
 * `ProjectEnvironmentCdnCopyService` to keep that service under the file-size
 * ceiling. All functions are pure.
 */

export type EnvironmentCdnConfigCopyStepStatus = 'planned' | 'applied' | 'skipped';

export type EnvironmentCdnConfigCopyStep = {
  status: EnvironmentCdnConfigCopyStepStatus;
  sourceCdnConfigId: string;
  targetCdnConfigId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export function buildCdnSkippedStep(
  config: any,
  baseMetadata: Record<string, unknown>,
  reason: string,
  description: string,
): EnvironmentCdnConfigCopyStep {
  return {
    status: 'skipped',
    sourceCdnConfigId: config.id,
    title: `CDN ${config.name}`,
    description,
    metadata: { ...baseMetadata, reason },
  };
}

export function buildCdnPlannedStep(config: any, targetName: string, baseMetadata: Record<string, unknown>): EnvironmentCdnConfigCopyStep {
  return {
    status: 'planned',
    sourceCdnConfigId: config.id,
    title: `复制 CDN ${config.name}`,
    description: `将以 pending CDN 配置复制到 ${targetName}`,
    metadata: baseMetadata,
  };
}

export function buildCdnAppliedStep(
  config: any,
  createdId: string,
  targetDomain: string,
  baseMetadata: Record<string, unknown>,
): EnvironmentCdnConfigCopyStep {
  return {
    status: 'applied',
    sourceCdnConfigId: config.id,
    targetCdnConfigId: createdId,
    title: `复制 CDN ${config.name}`,
    description: `已创建目标环境 pending CDN 配置 ${targetDomain}`,
    metadata: baseMetadata,
  };
}

/** Build the `createCDNConfig` data payload for a CDN-config copy. */
export function buildCreateCdnConfigData(
  teamId: string,
  userId: string,
  projectId: string,
  targetEnvironmentId: string,
  config: any,
  targetName: string,
  targetDomain: string,
  targetOrigin: string,
  targetCredentialId: string,
  toJsonValue: (value: unknown) => any,
) {
  return {
    teamId,
    createdById: userId,
    projectId,
    environmentId: targetEnvironmentId,
    credentialId: targetCredentialId,
    name: `${config.name} (${targetName})`,
    domain: targetDomain,
    origin: targetOrigin,
    provider: config.provider,
    cacheRules: config.cacheRules ? toJsonValue(config.cacheRules) : undefined,
    status: 'pending',
  };
}

/** Assemble the final CDN-config copy result object (counts + warnings). */
export function buildCdnConfigCopyResult(
  projectId: string,
  source: any,
  target: any,
  dryRun: boolean,
  steps: EnvironmentCdnConfigCopyStep[],
) {
  return {
    projectId,
    sourceEnvironment: { id: source.id, key: source.key, name: source.name },
    targetEnvironment: { id: target.id, key: target.key, name: target.name },
    dryRun,
    status: dryRun ? 'planned' : 'completed',
    plannedCount: steps.filter((step) => step.status === 'planned').length,
    appliedCount: steps.filter((step) => step.status === 'applied').length,
    skippedCount: steps.filter((step) => step.status === 'skipped').length,
    steps,
    warnings: [
      '只复制 CDN 配置骨架并创建 pending 配置，不调用云 provider API、不执行刷新或同步。',
      '不会复制 providerData、syncError，也不会读取或复用源环境凭据值。',
      '非 dry-run 时每个待复制 CDN 必须显式提供目标域名、目标源站和目标 credentialId。',
    ],
  };
}
