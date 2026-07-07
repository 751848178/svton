/**
 * Pure step/result builders for the project-environment sync-apply service.
 *
 * Owns the dry-run and applied step shaping for `create_missing_service` and
 * `complete_deploy_config`, plus the create-missing-service payload and the
 * missing-field computation. Extracted from `ProjectEnvironmentSyncApplyService`
 * to keep that service under the file-size ceiling. All functions are pure.
 */

import {
  previewList as previewListUtil,
  skippedServiceBindings as skippedServiceBindingsUtil,
  toJsonValue as toJsonValueUtil,
} from './project-environment-helpers.utils';
import {
  DEFAULT_SYNC_ACTION_KINDS,
  DEPLOY_CONFIG_FIELDS,
  DEPLOY_CONFIG_FIELD_LABELS,
  type EnvironmentSyncApplyStep,
} from './project-environment-sync.utils';

export function buildCreateMissingServicePlannedStep(
  sourceService: any,
  copiedDeployConfigFields: string[],
): EnvironmentSyncApplyStep {
  return {
    kind: 'create_missing_service',
    status: 'planned',
    title: `创建服务骨架 ${sourceService.application.name}/${sourceService.name}`,
    description: '将创建目标环境服务，但不会复制服务器、站点、托管资源、环境变量或密钥绑定。',
    targetType: 'application_service',
    sourceId: sourceService.id,
    metadata: {
      applicationId: sourceService.applicationId,
      serviceName: sourceService.name,
      copiedDeployConfigFields,
      skippedBindings: skippedServiceBindingsUtil(sourceService),
    },
  };
}

export function buildCreateMissingServiceAppliedStep(
  sourceService: any,
  createdId: string,
  copiedDeployConfigFields: string[],
): EnvironmentSyncApplyStep {
  return {
    kind: 'create_missing_service',
    status: 'applied',
    title: `已创建服务骨架 ${sourceService.application.name}/${sourceService.name}`,
    description: '已创建目标环境服务，并跳过服务器、站点、托管资源、环境变量和密钥绑定。',
    targetType: 'application_service',
    sourceId: sourceService.id,
    targetId: createdId,
    metadata: {
      applicationId: sourceService.applicationId,
      serviceName: sourceService.name,
      copiedDeployConfigFields,
      skippedBindings: skippedServiceBindingsUtil(sourceService),
    },
  };
}

export function buildCompleteDeployConfigPlannedStep(
  targetService: any,
  sourceService: any,
  missingFields: string[],
): EnvironmentSyncApplyStep {
  return {
    kind: 'complete_deploy_config',
    status: 'planned',
    title: `补齐部署配置 ${targetService.application.name}/${targetService.name}`,
    description: `将补齐 ${previewListUtil(missingFields.map((field) => DEPLOY_CONFIG_FIELD_LABELS[field as keyof typeof DEPLOY_CONFIG_FIELD_LABELS]))}，不会覆盖目标环境已有字段。`,
    targetType: 'application_service',
    sourceId: sourceService.id,
    targetId: targetService.id,
    metadata: {
      applicationId: targetService.applicationId,
      serviceName: targetService.name,
      fields: missingFields,
    },
  };
}

export function buildCompleteDeployConfigAppliedStep(
  targetService: any,
  sourceService: any,
  missingFields: string[],
): EnvironmentSyncApplyStep {
  return {
    kind: 'complete_deploy_config',
    status: 'applied',
    title: `已补齐部署配置 ${targetService.application.name}/${targetService.name}`,
    description: `已补齐 ${previewListUtil(missingFields.map((field) => DEPLOY_CONFIG_FIELD_LABELS[field as keyof typeof DEPLOY_CONFIG_FIELD_LABELS]))}，未覆盖目标环境已有字段。`,
    targetType: 'application_service',
    sourceId: sourceService.id,
    targetId: targetService.id,
    metadata: {
      applicationId: targetService.applicationId,
      serviceName: targetService.name,
      fields: missingFields,
    },
  };
}

/** Build the `createApplicationService` data payload for a missing-service apply. */
export function buildCreateMissingServiceData(
  teamId: string,
  projectId: string,
  targetEnvironmentId: string,
  sourceEnvironmentId: string,
  userId: string,
  sourceService: any,
  sourceDeployConfig: Record<string, any>,
) {
  const copiedDeployConfigFields = Object.keys(sourceDeployConfig);
  return {
    teamId,
    projectId,
    applicationId: sourceService.applicationId,
    environmentId: targetEnvironmentId,
    name: sourceService.name,
    kind: sourceService.kind,
    runtime: sourceService.runtime,
    image: sourceService.image,
    ports: sourceService.ports !== null ? toJsonValueUtil(sourceService.ports) : undefined,
    deployConfig: copiedDeployConfigFields.length > 0 ? toJsonValueUtil(sourceDeployConfig) : undefined,
    metadata: toJsonValueUtil({
      environmentSync: {
        sourceEnvironmentId,
        targetEnvironmentId,
        sourceApplicationServiceId: sourceService.id,
        copiedDeployConfigFields,
        skippedBindings: skippedServiceBindingsUtil(sourceService),
        copiedBy: userId,
        copiedAt: new Date().toISOString(),
      },
    }),
  };
}

/** Compute the deploy-config fields present on source but missing on target. */
export function computeMissingDeployConfigFields(
  sourceDeployConfig: Record<string, any>,
  readTargetField: (field: string) => unknown,
): string[] {
  return DEPLOY_CONFIG_FIELDS.filter((field) =>
    (sourceDeployConfig as any)[field] && !readTargetField(field),
  );
}

/** Merge missing source fields into the target deploy-config object. */
export function mergeDeployConfigFields(
  targetDeployConfig: Record<string, any>,
  sourceDeployConfig: Record<string, any>,
  missingFields: string[],
): Record<string, any> {
  return {
    ...targetDeployConfig,
    ...Object.fromEntries(missingFields.map((field) => [field, (sourceDeployConfig as any)[field]])),
  };
}

/** Resolve the effective action-kind set from the apply DTO (defaults applied). */
export function resolveActionKinds(actionKinds?: string[] | null): Set<string> {
  return new Set(actionKinds && actionKinds.length > 0 ? actionKinds : DEFAULT_SYNC_ACTION_KINDS);
}

/** findApplicationServices args for the sync-apply source/target service read. */
export const applyApplicationServicesArgs = (teamId: string, projectId: string, environmentIds: string[]) => ({
  where: { teamId, projectId, environmentId: { in: environmentIds }, status: { not: 'archived' } },
  select: {
    id: true, applicationId: true, environmentId: true, name: true, kind: true,
    runtime: true, image: true, ports: true, deployConfig: true, metadata: true,
    serverId: true, siteId: true, managedResourceId: true,
    application: { select: { id: true, name: true } },
  },
});
