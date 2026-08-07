/**
 * 环境配置区模型
 *
 * 单一职责：settings 环境配置区共享的纯模型——修订草稿类型、路由快照类型、
 * 草稿↔修订转换、以及环境角色/身份标签解析。组件层只能通过这里的函数取值。
 */

import type { EnvironmentConfigResourceReference } from '../../types/environment-config-revision.types';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';

export type SettingsRouteDraft = {
  domains: string;
  dnsProvider: string;
  tlsRequired: boolean;
  proxyTarget: string;
};

export type SettingsEnvironmentDraft = {
  secretIds: string[];
  policyIds: string[];
  resources: EnvironmentConfigResourceReference[];
  route: SettingsRouteDraft;
  summary: string;
};

export const EMPTY_SETTINGS_ENVIRONMENT_DRAFT: SettingsEnvironmentDraft = {
  secretIds: [],
  policyIds: [],
  resources: [],
  route: { domains: '', dnsProvider: '', tlsRequired: false, proxyTarget: '' },
  summary: '',
};

export function settingsDraftFromRevision(
  revision: EnvironmentConfigRevision | null,
): SettingsEnvironmentDraft | null {
  if (!revision) return null;
  return {
    secretIds: revision.secretReferences.map((item) => item.id),
    policyIds: revision.policyReferences.map((item) => item.id),
    resources: revision.resourceReferences,
    route: {
      domains: (revision.routeSnapshot?.domains ?? []).join('\n'),
      dnsProvider: revision.routeSnapshot?.dnsProvider ?? '',
      tlsRequired: revision.routeSnapshot?.tlsRequired ?? false,
      proxyTarget: revision.routeSnapshot?.proxyTarget ?? '',
    },
    summary: '',
  };
}

export function toConfigRevisionDraft(
  draft: SettingsEnvironmentDraft,
): {
  secretReferenceIds: string[];
  resourceReferences: EnvironmentConfigResourceReference[];
  routeSnapshot: Record<string, unknown>;
  policyReferenceIds: string[];
  changeSummary?: string;
} {
  return {
    secretReferenceIds: draft.secretIds,
    resourceReferences: draft.resources,
    routeSnapshot: {
      domains: draft.route.domains
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
      dnsProvider: draft.route.dnsProvider.trim() || undefined,
      tlsRequired: draft.route.tlsRequired,
      proxyTarget: draft.route.proxyTarget.trim() || undefined,
    },
    policyReferenceIds: draft.policyIds,
    changeSummary: draft.summary.trim() || undefined,
  };
}

export function environmentRoleLabelKey(env: {
  baselineRole?: 'staging' | 'production' | null;
  key: string;
}): string {
  if (env.baselineRole === 'staging') return 'envRoleStaging';
  if (env.baselineRole === 'production') return 'envRoleProduction';
  return 'envRoleCustom';
}

export function environmentIdentityLabelKey(env: {
  identityLockedAt?: string | null;
  _count?: { deploymentRuns?: number };
}): string {
  const hasRuns = (env._count?.deploymentRuns ?? 0) > 0;
  return env.identityLockedAt || hasRuns ? 'envIdentityLocked' : 'envIdentityUnlocked';
}

/**
 * AC-SET-016: a project is governed when it owns active Staging AND Production
 * baseline environments; governed projects get no env-template options.
 */
export function isGovernedEnvironmentSet(
  environments: Array<{ baselineRole?: 'staging' | 'production' | null; status: string }>,
): boolean {
  const active = environments.filter((env) => env.status !== 'archived');
  return (
    active.some((env) => env.baselineRole === 'staging') &&
    active.some((env) => env.baselineRole === 'production')
  );
}

export function isBaselineEnvironment(env: {
  baselineRole?: 'staging' | 'production' | null;
}): boolean {
  return env.baselineRole === 'staging' || env.baselineRole === 'production';
}
