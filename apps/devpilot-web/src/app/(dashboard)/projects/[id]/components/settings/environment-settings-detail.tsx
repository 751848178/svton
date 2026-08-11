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
  deliveryHref,
  readSettingsEnvTab,
  settingsHref,
  type SettingsEnvTab,
} from '../../utils/project-route.utils';
import { EnvironmentSettingsRevisionBar } from './environment-settings-revision-bar';
import { EnvironmentSettingsSummary } from './environment-settings-summary';
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
    tlsMode: 'managed_cert' | 'existing_cert_asset';
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
  const governance = useEnvironmentConfigGovernance(environment, projectId, detail.loadProject);
  const targets = useEnvironmentDeploymentTargets(environment.id);
  const [secrets, setSecrets] = useState<EnvironmentConfigSecretReference[]>([]);
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [resources, setResources] = useState<EnvironmentConfigResourceReference[]>([]);
  const [route, setRoute] = useState<RouteDraft>(EMPTY_ROUTE);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    const draft = settingsDraftFromRevision(governance.current);
    if (!draft) return;
    setSecrets(draft.secrets);
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
      await governance.save(toConfigRevisionDraft({ secrets, policyIds, resources, route, summary }));
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
  const resourceIssues = resourceDraftIssues(resources, governance.current?.resourceReferences ?? []);
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

      <EnvironmentSettingsRevisionBar
        inputId={summaryInputId}
        summary={summary}
        revisionCount={governance.data?.revisions.length ?? 0}
        saving={governance.saving}
        loading={governance.loading}
        invalid={draftInvalid}
        onSummaryChange={setSummary}
        onSave={save}
      />

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
    </div>
  );
}
