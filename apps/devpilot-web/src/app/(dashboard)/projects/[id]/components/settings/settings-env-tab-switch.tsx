/**
 * 环境配置子区切换
 *
 * 单一职责：按 envTab 把共享草稿上下文分发给对应的子区组件。
 */
'use client';

import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentConfigResourceReference } from '../../types/environment-config-revision.types';
import type { SettingsEnvTab } from '../../utils/project-route.utils';
import type { SettingsRouteDraft } from './settings-env.model';
import { EnvProtectionTab } from './settings-env-protection-tab';
import { EnvResourcesTab } from './settings-env-resources-tab';
import { EnvRoutesTab } from './settings-env-routes-tab';
import { EnvTargetsTab } from './settings-env-targets-tab';
import { EnvVariablesTab } from './settings-env-variables-tab';

export type DetailHook = ReturnType<typeof useProjectDetail>;

export interface EnvTabContext {
  detail: DetailHook;
  environment: ProjectEnvironment;
  secretIds: string[];
  setSecretIds: (next: string[]) => void;
  policyIds: string[];
  setPolicyIds: (next: string[]) => void;
  policies: Array<{ id: string; name: string; effect: string }>;
  resources: EnvironmentConfigResourceReference[];
  setResources: (next: EnvironmentConfigResourceReference[]) => void;
  route: SettingsRouteDraft;
  setRoute: (next: SettingsRouteDraft) => void;
}

export function renderEnvTab(envTab: SettingsEnvTab, ctx: EnvTabContext) {
  switch (envTab) {
    case 'targets':
      return <EnvTargetsTab environment={ctx.environment} detail={ctx.detail} />;
    case 'resources':
      return (
        <EnvResourcesTab
          environment={ctx.environment}
          detail={ctx.detail}
          resources={ctx.resources}
          onResourcesChange={ctx.setResources}
        />
      );
    case 'variables':
      return (
        <EnvVariablesTab
          environment={ctx.environment}
          detail={ctx.detail}
          secretIds={ctx.secretIds}
          onSecretIdsChange={ctx.setSecretIds}
        />
      );
    case 'routes':
      return (
        <EnvRoutesTab
          environment={ctx.environment}
          detail={ctx.detail}
          route={ctx.route}
          onRouteChange={ctx.setRoute}
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
        />
      );
  }
}
