/**
 * 环境配置子区切换
 *
 * 单一职责：按 envTab 把共享草稿上下文分发给对应的子区组件。
 */
'use client';

import type { useProjectDetail } from '../../hooks/use-project-detail';
import { useEnvironmentDeploymentTargets } from '../../hooks/use-environment-deployment-targets';
import type { ProjectEnvironment } from '../../types';
import type {
  EnvironmentConfigResourceReference,
  EnvironmentConfigRevision,
  EnvironmentConfigSecretReference,
} from '../../types/environment-config-revision.types';
import type { SettingsEnvTab } from '../../utils/project-route.utils';
import type { SettingsObservabilityDraft, SettingsRouteDraft } from './settings-env.model';
import { EnvProtectionTab } from './settings-env-protection-tab';
import { EnvResourcesTab } from './settings-env-resources-tab';
import { EnvRoutesTab } from './settings-env-routes-tab';
import { EnvTargetsTab } from './settings-env-targets-tab';
import { EnvVariablesTab } from './settings-env-variables-tab';

export type DetailHook = ReturnType<typeof useProjectDetail>;
export type DeploymentTargetsHook = ReturnType<typeof useEnvironmentDeploymentTargets>;

export interface EnvTabContext {
  detail: DetailHook;
  environment: ProjectEnvironment;
  targets: DeploymentTargetsHook;
  secrets: EnvironmentConfigSecretReference[];
  setSecrets: (next: EnvironmentConfigSecretReference[]) => void;
  policyIds: string[];
  setPolicyIds: (next: string[]) => void;
  policies: Array<{ id: string; name: string; effect: string }>;
  resources: EnvironmentConfigResourceReference[];
  setResources: (next: EnvironmentConfigResourceReference[]) => void;
  route: SettingsRouteDraft;
  setRoute: (next: SettingsRouteDraft) => void;
  observability: SettingsObservabilityDraft['profile'];
  setObservability: (next: SettingsObservabilityDraft['profile']) => void;
  /** 当前不可变修订（资源绑定子区用于展示冻结修订号）。 */
  revision: EnvironmentConfigRevision | null;
  /** 全部不可变修订（变量与密钥子区展示修订历史）。 */
  revisions: EnvironmentConfigRevision[];
  /** 项目全部环境（变量与密钥子区用于跨环境复用选择）。 */
  environments: ProjectEnvironment[];
}

export function renderEnvTab(envTab: SettingsEnvTab, ctx: EnvTabContext) {
  switch (envTab) {
    case 'targets':
      return <EnvTargetsTab environment={ctx.environment} detail={ctx.detail} targets={ctx.targets} />;
    case 'resources':
      return (
        <EnvResourcesTab
          environment={ctx.environment}
          detail={ctx.detail}
          resources={ctx.resources}
          onResourcesChange={ctx.setResources}
          revision={ctx.revision}
        />
      );
    case 'variables':
      return (
        <EnvVariablesTab
          environment={ctx.environment}
          detail={ctx.detail}
          secretReferences={ctx.secrets}
          onSecretReferencesChange={ctx.setSecrets}
          resources={ctx.resources}
          revision={ctx.revision}
          revisions={ctx.revisions}
          environments={ctx.environments}
        />
      );
    case 'routes':
      return (
        <EnvRoutesTab
          environment={ctx.environment}
          detail={ctx.detail}
          route={ctx.route}
          onRouteChange={ctx.setRoute}
          revision={ctx.revision}
          deploymentRuns={ctx.detail.deploymentRuns}
        />
      );
    case 'protection':
      return (
        <EnvProtectionTab
          environment={ctx.environment}
          detail={ctx.detail}
          policies={ctx.policies}
          policyIds={ctx.policyIds}
          onPolicyIdsChange={ctx.setPolicyIds}
          observability={ctx.observability}
          onObservabilityChange={ctx.setObservability}
        />
      );
  }
}
