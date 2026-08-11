import type { ProjectEnvironment } from '../../types';

export type SettingsEnvironmentGroup = {
  key: 'release-baseline' | 'custom';
  labelKey: 'directoryBaselines' | 'envRoleCustom';
  environments: ProjectEnvironment[];
};

export function groupSettingsEnvironments(
  environments: ProjectEnvironment[],
): SettingsEnvironmentGroup[] {
  const active = environments.filter((environment) => environment.status !== 'archived');
  const baselines = active.filter((environment) => environment.baselineRole != null);
  const custom = active.filter((environment) => environment.baselineRole == null);
  const groups: SettingsEnvironmentGroup[] = [
    { key: 'release-baseline', labelKey: 'directoryBaselines', environments: baselines },
    { key: 'custom', labelKey: 'envRoleCustom', environments: custom },
  ];
  return groups.filter((group) => group.environments.length > 0);
}
