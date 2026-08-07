/**
 * 环境配置详情
 *
 * 单一职责：为选中的环境挂载配置修订 Hook 与共享草稿，编排 env-summary、
 * config-revision 条（含唯一「创建配置修订」入口）、五个子区导航与内容切换。
 * 由外层按 environment.id 作为 key 挂载，环境切换时自动重置草稿。
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { feedback } from '@/components/ui/feedback/feedback';
import { useEnvironmentConfigGovernance } from '../../hooks/use-environment-config-governance';
import { useEnvironmentDeploymentTargets } from '../../hooks/use-environment-deployment-targets';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentConfigResourceReference } from '../../types/environment-config-revision.types';
import {
  deliveryHref,
  readSettingsEnvTab,
  settingsHref,
  type SettingsEnvTab,
} from '../../utils/project-route.utils';
import { EnvironmentSettingsSummary } from './environment-settings-summary';
import { settingsDraftFromRevision, toConfigRevisionDraft } from './settings-env.model';
import { renderEnvTab, type EnvTabContext } from './settings-env-tab-switch';

type DetailHook = ReturnType<typeof useProjectDetail>;
type RouteDraft = {
  domains: string;
  dnsProvider: string;
  tlsRequired: boolean;
  proxyTarget: string;
  entries: Array<{
    domain: string;
    path: string;
    component: string;
    port: number | null;
    tlsMode: 'managed_cert' | 'existing_cert_asset';
  }>;
};

const ENV_TAB_KEYS: Array<{ key: SettingsEnvTab; labelKey: string }> = [
  { key: 'targets', labelKey: 'envTabTargets' },
  { key: 'resources', labelKey: 'envTabResources' },
  { key: 'variables', labelKey: 'envTabVariables' },
  { key: 'routes', labelKey: 'envTabRoutes' },
  { key: 'protection', labelKey: 'envTabProtection' },
];

const EMPTY_ROUTE: RouteDraft = {
  domains: '',
  dnsProvider: '',
  tlsRequired: false,
  proxyTarget: '',
  entries: [],
};

export function EnvironmentSettingsDetail({
  detail,
  environment,
}: {
  detail: DetailHook;
  environment: ProjectEnvironment;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = detail.project?.id ?? '';
  const envTab = readSettingsEnvTab(searchParams);
  const governance = useEnvironmentConfigGovernance(environment, projectId, detail.loadProject);
  const targets = useEnvironmentDeploymentTargets(environment.id);
  const [secretIds, setSecretIds] = useState<string[]>([]);
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [resources, setResources] = useState<EnvironmentConfigResourceReference[]>([]);
  const [route, setRoute] = useState<RouteDraft>(EMPTY_ROUTE);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    const draft = settingsDraftFromRevision(governance.current);
    if (!draft) return;
    setSecretIds(draft.secretIds);
    setPolicyIds(draft.policyIds);
    setResources(draft.resources);
    setRoute(draft.route);
    setSummary('');
    // 草稿只从当前修订初始化；修订推进由 governance Hook 自身刷新历史。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governance.current?.id, environment.id]);

  const selectTab = (next: SettingsEnvTab) => {
    const params = new URLSearchParams(searchParams);
    params.set('env', environment.key);
    params.set('envTab', next);
    router.replace(settingsHref(projectId, 'environments', params), { scroll: false });
  };

  const save = async () => {
    try {
      await governance.save(toConfigRevisionDraft({ secretIds, policyIds, resources, route, summary }));
      setSummary('');
      feedback.success(t('configRevisionSaveSuccess'));
    } catch (cause) {
      feedback.error(t('configRevisionSaveFailed'), {
        description: cause instanceof Error ? cause.message : undefined,
      });
    }
  };

  const context: EnvTabContext = {
    detail,
    environment,
    targets,
    secretIds,
    setSecretIds,
    policyIds,
    setPolicyIds,
    policies: governance.policies,
    resources,
    setResources,
    route,
    setRoute,
    revision: governance.current,
    revisions: governance.data?.revisions ?? [],
    environments: detail.project?.environments ?? [],
  };

  return (
    <div className="space-y-4">
      <EnvironmentSettingsSummary
        environment={environment}
        revision={governance.current}
        policyCount={governance.policies.length}
        deploymentRunCount={environment._count?.deploymentRuns ?? 0}
        versionsHref={deliveryHref(projectId, 'environment-versions', searchParams)}
        deploymentsHref={deliveryHref(projectId, 'deployments', searchParams)}
        currentTarget={targets.data?.currentTarget ?? null}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2">
        <input
          className="min-w-40 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={t('configChangeSummary')}
        />
        <span className="text-[11px] text-muted-foreground">
          {t('configRevisionHistoryCount', { count: governance.data?.revisions.length ?? 0 })}
        </span>
        <Button size="sm" onClick={save} disabled={governance.saving || governance.loading}>
          {governance.saving ? t('saving') : t('configCreateRevision')}
        </Button>
      </div>

      <nav className="flex flex-wrap gap-1 border-b" aria-label={t('envTabNavLabel')}>
        {ENV_TAB_KEYS.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            aria-current={envTab === key ? 'page' : undefined}
            className={
              envTab === key
                ? 'border-b-2 border-primary px-3 py-1.5 text-xs font-medium text-primary'
                : 'px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground'
            }
          >
            {t(labelKey)}
          </button>
        ))}
      </nav>

      <div className="min-w-0">{renderEnvTab(envTab, context)}</div>
    </div>
  );
}
