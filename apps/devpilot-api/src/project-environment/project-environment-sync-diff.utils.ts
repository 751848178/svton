/**
 * Pure sync-difference computation helpers.
 *
 * Extracted verbatim from `ProjectEnvironmentService` private methods so the
 * sync-suggestions orchestrator stays under the 200-line ceiling. Stateless
 * computation of environment sync differences, suggestion actions, and
 * difference labels. No behavior change.
 */

import type {
  DeployConfigCoverage,
  DeployConfigField,
  EnvironmentSyncDifferences,
  EnvironmentSyncProfile,
  EnvironmentSyncSuggestionAction,
} from './project-environment.service';
import {
  missingItems,
  previewList,
  readConfigString,
} from './project-environment-helpers.utils';

const DEPLOY_CONFIG_FIELDS: DeployConfigField[] = [
  'workingDirectory', 'buildCommand', 'deployCommand', 'healthCheckUrl', 'rollbackCommand',
];

const DEPLOY_CONFIG_FIELD_LABELS: Record<DeployConfigField, string> = {
  workingDirectory: '工作目录', buildCommand: '构建命令', deployCommand: '部署命令',
  healthCheckUrl: '健康检查', rollbackCommand: '回滚命令',
};

export function buildDeployConfigCoverage(services: Array<{ deployConfig: unknown }>): DeployConfigCoverage {
  return {
    total: services.length,
    workingDirectory: services.filter((s: any) => readConfigString(s.deployConfig, 'workingDirectory')).length,
    buildCommand: services.filter((s: any) => readConfigString(s.deployConfig, 'buildCommand')).length,
    deployCommand: services.filter((s: any) => readConfigString(s.deployConfig, 'deployCommand')).length,
    healthCheckUrl: services.filter((s: any) => readConfigString(s.deployConfig, 'healthCheckUrl')).length,
    rollbackCommand: services.filter((s: any) => readConfigString(s.deployConfig, 'rollbackCommand')).length,
  };
}

export function findReferenceProfile(profiles: EnvironmentSyncProfile[], referenceEnvironmentId?: string) {
  if (referenceEnvironmentId) {
    return profiles.find((p) => p.environment.id === referenceEnvironmentId) || null;
  }
  return (
    profiles.find((p) => ['prod', 'production'].includes(p.environment.key.toLowerCase())) ||
    profiles.find((p) => ['prod', 'production', '生产'].some((t) => p.environment.name.toLowerCase().includes(t))) ||
    profiles[profiles.length - 1] || null
  );
}

export function emptySyncDifferences(): EnvironmentSyncDifferences {
  const empty = { serverRoles: [], services: [], resourceKinds: [], siteRuntimeTypes: [], secretTypes: [], cdnProviders: [] };
  return { missing: { ...empty }, extra: { ...empty }, deployConfigGaps: [], serviceBindingGapDelta: 0, tlsSiteGap: 0, successfulDeploymentGap: false };
}

export function buildSyncDifferences(profile: EnvironmentSyncProfile, reference: EnvironmentSyncProfile): EnvironmentSyncDifferences {
  if (profile.environment.id === reference.environment.id) return emptySyncDifferences();
  return {
    missing: {
      serverRoles: missingItems(profile.serverRoleKeys, reference.serverRoleKeys),
      services: missingItems(profile.serviceKeys, reference.serviceKeys),
      resourceKinds: missingItems(profile.resourceKindKeys, reference.resourceKindKeys),
      siteRuntimeTypes: missingItems(profile.siteRuntimeKeys, reference.siteRuntimeKeys),
      secretTypes: missingItems(profile.secretTypeKeys, reference.secretTypeKeys),
      cdnProviders: missingItems(profile.cdnProviderKeys, reference.cdnProviderKeys),
    },
    extra: {
      serverRoles: missingItems(reference.serverRoleKeys, profile.serverRoleKeys),
      services: missingItems(reference.serviceKeys, profile.serviceKeys),
      resourceKinds: missingItems(reference.resourceKindKeys, profile.resourceKindKeys),
      siteRuntimeTypes: missingItems(reference.siteRuntimeKeys, profile.siteRuntimeKeys),
      secretTypes: missingItems(reference.secretTypeKeys, profile.secretTypeKeys),
      cdnProviders: missingItems(reference.cdnProviderKeys, profile.cdnProviderKeys),
    },
    deployConfigGaps: DEPLOY_CONFIG_FIELDS.map((field) => ({ field, missingCount: Math.max(0, reference.deployConfigCoverage[field] - profile.deployConfigCoverage[field]) })).filter((g) => g.missingCount > 0),
    serviceBindingGapDelta: Math.max(0, profile.serviceBindingGapCount - reference.serviceBindingGapCount),
    tlsSiteGap: Math.max(0, reference.tlsSiteCount - profile.tlsSiteCount),
    successfulDeploymentGap: profile.successfulDeployments === 0 && reference.successfulDeployments > 0,
  };
}

export function buildSyncSuggestionActions(profile: EnvironmentSyncProfile, reference: EnvironmentSyncProfile, differences: EnvironmentSyncDifferences): EnvironmentSyncSuggestionAction[] {
  const actions: EnvironmentSyncSuggestionAction[] = [];
  const mb = { sourceEnvironmentId: reference.environment.id, targetEnvironmentId: profile.environment.id };
  if (differences.missing.serverRoles.length > 0) actions.push({ kind: 'bind_server_role', severity: 'warning', title: `补齐服务器角色：${previewList(differences.missing.serverRoles)}`, description: '为目标环境绑定对应用途的服务器，后续部署、站点同步和资源采集才能按环境收敛。', target: 'resource-control', metadata: { ...mb, roles: differences.missing.serverRoles } });
  if (differences.missing.services.length > 0) actions.push({ kind: 'create_missing_service', severity: 'warning', title: `补齐应用服务：${previewList(differences.missing.services)}`, description: '为目标环境创建同名服务或声明该环境无需部署，避免仅生产环境有服务定义。', target: 'applications', metadata: { ...mb, services: differences.missing.services } });
  if (differences.deployConfigGaps.length > 0) actions.push({ kind: 'complete_deploy_config', severity: 'warning', title: `补齐部署配置：${previewList(differences.deployConfigGaps.map((g) => DEPLOY_CONFIG_FIELD_LABELS[g.field] || g.field))}`, description: '补齐工作目录、构建、部署、健康检查或回滚命令后，该环境才能接入构建部署。', target: 'applications', metadata: { ...mb, gaps: differences.deployConfigGaps } });
  if (differences.serviceBindingGapDelta > 0) actions.push({ kind: 'bind_service_runtime', severity: 'warning', title: `补齐运行绑定：${differences.serviceBindingGapDelta} 个服务缺口`, description: '为服务绑定服务器、站点或托管资源，避免部署计划生成后找不到运行目标。', target: 'applications', metadata: { ...mb, gapCount: differences.serviceBindingGapDelta } });
  if (differences.missing.resourceKinds.length > 0) actions.push({ kind: 'bind_resource_kind', severity: 'warning', title: `补齐资源类型：${previewList(differences.missing.resourceKinds)}`, description: '把目标环境实际使用的 Docker、数据库、日志或对象存储资源绑定到项目环境。', target: 'resource-control', metadata: { ...mb, resourceKinds: differences.missing.resourceKinds } });
  if (differences.missing.siteRuntimeTypes.length > 0) actions.push({ kind: 'create_site_runtime', severity: 'info', title: `补齐站点运行时：${previewList(differences.missing.siteRuntimeTypes)}`, description: '为目标环境创建相同类型的站点入口，并按环境配置域名、TLS 和源站。', target: 'sites', metadata: { ...mb, runtimeTypes: differences.missing.siteRuntimeTypes } });
  if (differences.missing.cdnProviders.length > 0) actions.push({ kind: 'create_cdn_config', severity: 'info', title: `补齐 CDN：${previewList(differences.missing.cdnProviders)}`, description: '为目标环境创建或绑定同类 CDN 配置，避免域名加速只覆盖部分环境。', target: 'cdn-configs', metadata: { ...mb, providers: differences.missing.cdnProviders } });
  if (differences.missing.secretTypes.length > 0) actions.push({ kind: 'create_secret_type', severity: 'warning', title: `补齐密钥类型：${previewList(differences.missing.secretTypes)}`, description: '为目标环境创建对应类型密钥，后续才能安全注入服务配置。', target: 'keys', metadata: { ...mb, secretTypes: differences.missing.secretTypes } });
  if (differences.tlsSiteGap > 0) actions.push({ kind: 'enable_site_tls', severity: 'info', title: `补齐 TLS 站点：${differences.tlsSiteGap} 个`, description: '检查目标环境站点的 TLS 配置，避免生产以外环境缺少证书探测和续期治理。', target: 'sites', metadata: { ...mb, gapCount: differences.tlsSiteGap } });
  if (differences.successfulDeploymentGap) actions.push({ kind: 'run_deployment', severity: 'info', title: '补一次成功部署记录', description: '目标环境还没有成功部署记录，可先生成 dry-run 或队列化部署计划验证链路。', target: 'applications', metadata: mb });
  return actions.slice(0, 10);
}

export function buildDifferenceLabels(differences: EnvironmentSyncDifferences) {
  const labels: string[] = [];
  const addLabels = (label: string, missing: string[], extra: string[]) => {
    if (missing.length > 0) labels.push(`${label}少 ${previewList(missing, 2)}`);
    if (extra.length > 0) labels.push(`${label}多 ${previewList(extra, 2)}`);
  };
  addLabels('服务器角色', differences.missing.serverRoles, differences.extra.serverRoles);
  addLabels('服务', differences.missing.services, differences.extra.services);
  addLabels('资源类型', differences.missing.resourceKinds, differences.extra.resourceKinds);
  addLabels('站点运行时', differences.missing.siteRuntimeTypes, differences.extra.siteRuntimeTypes);
  addLabels('CDN', differences.missing.cdnProviders, differences.extra.cdnProviders);
  addLabels('密钥类型', differences.missing.secretTypes, differences.extra.secretTypes);
  for (const gap of differences.deployConfigGaps) labels.push(`${DEPLOY_CONFIG_FIELD_LABELS[gap.field] || gap.field}少 ${gap.missingCount}`);
  if (differences.serviceBindingGapDelta > 0) labels.push(`运行绑定缺口多 ${differences.serviceBindingGapDelta}`);
  if (differences.tlsSiteGap > 0) labels.push(`TLS 站点少 ${differences.tlsSiteGap}`);
  if (differences.successfulDeploymentGap) labels.push('缺成功部署');
  return labels.slice(0, 12);
}
