/**
 * Pure step/result builders for the project-environment resource-copy service.
 *
 * Owns the per-resource and per-secret copy-step shaping (skipped/planned/
 * applied), the resource/secret create payloads, and the final apply-result
 * assembly. Extracted from `ProjectEnvironmentResourceCopyService` to keep that
 * service under the file-size ceiling. All functions are pure.
 */

export type EnvironmentResourceCopyStepType = 'managed_resource' | 'secret_key';

export type EnvironmentResourceCopyStepStatus = 'planned' | 'applied' | 'skipped';

export type EnvironmentResourceCopyStep = {
  type: EnvironmentResourceCopyStepType;
  status: EnvironmentResourceCopyStepStatus;
  sourceId: string;
  targetId?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export function buildResourceSkippedStep(
  resource: any,
  baseMetadata: Record<string, unknown>,
  reason: string,
  description: string,
): EnvironmentResourceCopyStep {
  return {
    type: 'managed_resource',
    status: 'skipped',
    sourceId: resource.id,
    title: `资源 ${resource.name}`,
    description,
    metadata: { ...baseMetadata, reason },
  };
}

export function buildResourcePlannedStep(resource: any, targetName: string, targetExternalId: string, baseMetadata: Record<string, unknown>): EnvironmentResourceCopyStep {
  return {
    type: 'managed_resource',
    status: 'planned',
    sourceId: resource.id,
    title: `复制资源 ${resource.name}`,
    description: `将以 unknown 状态复制到 ${targetName}，目标 externalId ${targetExternalId}`,
    metadata: baseMetadata,
  };
}

export function buildResourceAppliedStep(resource: any, createdId: string, targetExternalId: string, baseMetadata: Record<string, unknown>): EnvironmentResourceCopyStep {
  return {
    type: 'managed_resource',
    status: 'applied',
    sourceId: resource.id,
    targetId: createdId,
    title: `复制资源 ${resource.name}`,
    description: `已创建目标环境资源索引 ${targetExternalId}`,
    metadata: baseMetadata,
  };
}

export function buildSecretSkippedStep(
  secret: any,
  baseMetadata: Record<string, unknown>,
  reason: string,
  description: string,
): EnvironmentResourceCopyStep {
  return {
    type: 'secret_key',
    status: 'skipped',
    sourceId: secret.id,
    title: `密钥 ${secret.name}`,
    description,
    metadata: { ...baseMetadata, reason },
  };
}

export function buildSecretPlannedStep(secret: any, targetName: string, baseMetadata: Record<string, unknown>): EnvironmentResourceCopyStep {
  return {
    type: 'secret_key',
    status: 'planned',
    sourceId: secret.id,
    title: `复制密钥 ${secret.name}`,
    description: `将以新提供的值复制到 ${targetName}`,
    metadata: baseMetadata,
  };
}

export function buildSecretAppliedStep(secret: any, createdId: string, targetName: string): EnvironmentResourceCopyStep {
  return {
    type: 'secret_key',
    status: 'applied',
    sourceId: secret.id,
    targetId: createdId,
    title: `复制密钥 ${secret.name}`,
    description: `已创建目标环境密钥 ${targetName}`,
    metadata: { hasTargetValue: true },
  };
}

/** Build the `createManagedResource` data payload for a resource copy. */
export function buildCreateManagedResourceData(
  teamId: string,
  userId: string,
  projectId: string,
  targetEnvironmentId: string,
  resource: any,
  targetName: string,
  targetExternalId: string,
  targetEndpoint: string | undefined,
  targetServerId: string | undefined,
  targetCredentialId: string | undefined,
) {
  return {
    teamId,
    createdById: userId,
    projectId,
    environmentId: targetEnvironmentId,
    serverId: targetServerId || undefined,
    credentialId: targetCredentialId || undefined,
    sourceType: resource.sourceType,
    provider: resource.provider,
    kind: resource.kind,
    name: targetName,
    externalId: targetExternalId,
    endpoint: targetEndpoint || undefined,
    status: 'unknown',
  };
}

/** Build the `createSecretKey` data payload for a secret copy. */
export function buildCreateSecretKeyData(
  teamId: string,
  userId: string,
  projectId: string,
  targetEnvironmentId: string,
  secret: any,
  targetName: string,
  encryptedValue: string,
  targetDescription: string | undefined,
) {
  return {
    teamId,
    createdById: userId,
    projectId,
    environmentId: targetEnvironmentId,
    name: targetName,
    type: secret.type,
    value: encryptedValue,
    description: targetDescription,
  };
}

/** Assemble the final resource-copy result object (counts + warnings). */
export function buildResourceCopyResult(
  projectId: string,
  source: any,
  target: any,
  dryRun: boolean,
  steps: EnvironmentResourceCopyStep[],
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
      '只复制 ManagedResource 和 SecretKey 骨架，不创建或修改真实外部资源。',
      'ManagedResource 不复制 metadata、config、syncError、lastSyncAt、resourceInstanceId，也不会自动复用源 server/credential。',
      'SecretKey 不读取源密钥值；非 dry-run 时必须为每个目标密钥显式提供新 value，且审计 metadata 不记录该值。',
    ],
  };
}
