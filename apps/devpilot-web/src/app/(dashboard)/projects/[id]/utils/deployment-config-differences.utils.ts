import type { EnvironmentConfigProfile } from '../types/environment-sync';

type ConfigProfileWithoutDifferences = Omit<EnvironmentConfigProfile, 'differences'>;

export function previewList(items: string[], max = 3): string {
  if (items.length === 0) return '无';
  const preview = items.slice(0, max).join('、');
  return items.length > max ? `${preview} 等 ${items.length} 项` : preview;
}

export function findConfigReferenceProfile(profiles: ConfigProfileWithoutDifferences[]) {
  return (
    profiles.find((p) => ['prod', 'production'].includes(p.environment.key.toLowerCase())) ||
    profiles.find((p) =>
      ['prod', 'production', '生产'].some((t) => p.environment.name.toLowerCase().includes(t)),
    ) ||
    profiles[profiles.length - 1] ||
    null
  );
}

export function buildConfigDifferences(
  profile: ConfigProfileWithoutDifferences,
  reference: ConfigProfileWithoutDifferences,
): string[] {
  if (profile.environment.id === reference.environment.id) return [];
  const differences: string[] = [];
  addSetDifferences(differences, '服务', profile.serviceKeys, reference.serviceKeys);
  addSetDifferences(differences, '资源类型', profile.resourceKindKeys, reference.resourceKindKeys);
  addSetDifferences(differences, '密钥类型', profile.secretTypeKeys, reference.secretTypeKeys);
  addSetDifferences(differences, '站点运行时', profile.siteRuntimeKeys, reference.siteRuntimeKeys);
  addDeployConfigDifferences(differences, profile, reference);
  if (profile.serviceBindingGapCount > reference.serviceBindingGapCount) {
    differences.push(
      `运行绑定缺口多 ${profile.serviceBindingGapCount - reference.serviceBindingGapCount}`,
    );
  }
  if (profile.tlsSiteCount < reference.tlsSiteCount) {
    differences.push(`TLS 站点少 ${reference.tlsSiteCount - profile.tlsSiteCount}`);
  }
  if (profile.successfulDeployments === 0 && reference.successfulDeployments > 0) {
    differences.push('缺成功部署');
  }
  return differences.slice(0, 10);
}

function addDeployConfigDifferences(
  differences: string[],
  profile: ConfigProfileWithoutDifferences,
  reference: ConfigProfileWithoutDifferences,
): void {
  if (profile.deployConfigCoverage.total < reference.deployConfigCoverage.total) {
    differences.push(
      `服务数少 ${reference.deployConfigCoverage.total - profile.deployConfigCoverage.total}`,
    );
  }
  if (profile.deployConfigCoverage.deployCommand < reference.deployConfigCoverage.deployCommand) {
    differences.push(
      `部署命令少 ${reference.deployConfigCoverage.deployCommand - profile.deployConfigCoverage.deployCommand}`,
    );
  }
  if (profile.deployConfigCoverage.healthCheckUrl < reference.deployConfigCoverage.healthCheckUrl) {
    differences.push(
      `健康检查少 ${reference.deployConfigCoverage.healthCheckUrl - profile.deployConfigCoverage.healthCheckUrl}`,
    );
  }
}

function addSetDifferences(
  differences: string[],
  label: string,
  current: string[],
  reference: string[],
): void {
  const missing = reference.filter((item) => !current.includes(item));
  const extra = current.filter((item) => !reference.includes(item));
  if (missing.length > 0) differences.push(`${label}少 ${previewList(missing, 2)}`);
  if (extra.length > 0) differences.push(`${label}多 ${previewList(extra, 2)}`);
}
