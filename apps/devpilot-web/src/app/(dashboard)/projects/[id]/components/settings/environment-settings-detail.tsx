/**
 * 环境配置详情
 *
 * 单一职责：为选中的环境挂载配置修订 Hook 与共享草稿，编排 env-summary、
 * config-revision 条（含唯一「创建配置修订」入口）、五个子区导航与内容切换。
 * 由外层按 environment.id 作为 key 挂载，环境切换时自动重置草稿。
 */
'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import { useEnvironmentConfigGovernance } from '../../hooks/use-environment-config-governance';
import { useEnvironmentDeploymentTargets } from '../../hooks/use-environment-deployment-targets';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import type {
  EnvironmentConfigResourceReference,
  EnvironmentConfigSecretReference,
} from '../../types/environment-config-revision.types';
import {
  readSettingsEnvTab,
  settingsHref,
  type SettingsEnvTab,
} from '../../utils/project-route.utils';
import { selectExistingProjectEnvironments } from '../../utils/project-environment-list';
import { EnvironmentSettingsRevisionBar } from './environment-settings-revision-bar';
import { EnvironmentSettingsTablist } from './environment-settings-tablist';
import { settingsDraftFromRevision, toConfigRevisionDraft } from './settings-env.model';
import { resourceDraftIssues } from './settings-resource-binding-preview.model';
import { findVariableBindingCollisions } from './settings-variable-binding.model';
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
    tlsMode: 'none' | 'managed_cert' | 'existing_cert_asset';
  }>;
};

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
  const tablistId = useId();
  const panelId = `${tablistId}-${envTab}-panel`;
  const summaryInputId = useId();
  const governance = useEnvironmentConfigGovernance(
    environment,
    projectId,
    detail.loadProject,
    envTab === 'access',
  );
  const targets = useEnvironmentDeploymentTargets(environment.id, envTab === 'targets');
  const [secrets, setSecrets] = useState<EnvironmentConfigSecretReference[]>([]);
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [resources, setResources] = useState<EnvironmentConfigResourceReference[]>([]);
  const [route, setRoute] = useState<RouteDraft>(EMPTY_ROUTE);
  const [summary, setSummary] = useState('');
  const [observability, setObservability] = useState<'' | 'local_acceptance_v1'>('');
  // SET-16：记录「与当前修订一致」的基线快照，用于判定无变更时禁用保存。
  const [baselineKey, setBaselineKey] = useState('');

  useEffect(() => {
    const draft = settingsDraftFromRevision(governance.current);
    if (!draft) return;
    setSecrets(draft.secrets);
    setPolicyIds(draft.policyIds);
    setResources(draft.resources);
    setRoute(draft.route);
    setObservability(draft.observability.profile);
    setSummary('');
    setBaselineKey(
      JSON.stringify([draft.secrets, draft.policyIds, draft.resources, draft.route, draft.observability.profile]),
    );
    // 草稿只从当前修订初始化；修订推进由 governance Hook 自身刷新历史。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governance.current?.id, environment.id]);

  const noDraftChanges =
    Boolean(baselineKey) &&
    JSON.stringify([secrets, policyIds, resources, route, observability]) === baselineKey;

  const selectTab = (next: SettingsEnvTab) => {
    const params = new URLSearchParams(searchParams);
    params.set('env', environment.key);
    params.set('envTab', next);
    router.replace(settingsHref(projectId, 'environments', params), { scroll: false });
  };

  const save = async () => {
    try {
      await governance.save(
        toConfigRevisionDraft({
          secrets,
          policyIds,
          resources,
          route,
          summary,
          observability: { profile: observability },
        }),
      );
      setSummary('');
      feedback.success(t('configRevisionSaveSuccess'));
    } catch (cause) {
      feedback.error(t('configRevisionSaveFailed'), {
        description: cause instanceof Error ? cause.message : undefined,
      });
    }
  };
  const plainKeys = Object.keys(environment.config?.envVars ?? {});
  const collisions = findVariableBindingCollisions(plainKeys, secrets, resources);
  const resourceIssues = resourceDraftIssues(
    resources,
    governance.current?.resourceReferences ?? [],
  );
  const draftInvalid = collisions.length > 0 || resourceIssues.length > 0;

  const context: EnvTabContext = {
    detail,
    environment,
    targets,
    secrets,
    setSecrets,
    policyIds,
    setPolicyIds,
    policies: governance.policies,
    resources,
    setResources,
    route,
    setRoute,
    observability,
    setObservability,
    revision: governance.current,
    revisions: governance.data?.revisions ?? [],
    // SET-7: 复用配置的目标环境必须来自项目实际环境；直接透传 project.environments
    // 会把遗留未使用的种子环境（如 prod/test）带进选择列表。
    environments: selectExistingProjectEnvironments(detail.project?.environments),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
      <EnvironmentSettingsTablist
        tablistId={tablistId}
        panelId={panelId}
        selected={envTab}
        onSelect={selectTab}
      />

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${tablistId}-${envTab}-tab`}
        className="min-w-0"
      >
        {renderEnvTab(envTab, context)}
      </div>

      <details className="rounded-lg border bg-muted/20 lg:col-start-2">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">
          {t('environmentSettingsRevisionDetails')}
        </summary>
        <div className="space-y-4 border-t p-4">
          <EnvironmentSettingsRevisionBar
            inputId={summaryInputId}
            summary={summary}
            revisionCount={governance.data?.revisions.length ?? 0}
            revisions={governance.data?.revisions ?? []}
            saving={governance.saving}
            loading={governance.loading}
            invalid={draftInvalid}
            noChanges={noDraftChanges}
            onSummaryChange={setSummary}
            onSave={save}
          />
        </div>
      </details>
    </div>
  );
}
