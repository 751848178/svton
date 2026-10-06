'use client';

import React, { useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import { useEnvironmentConfigGovernance } from '../../hooks/use-environment-config-governance';
import { useEnvironmentDeploymentTargets } from '../../hooks/use-environment-deployment-targets';
import { isValidEnvKey } from '../../hooks/use-environment-env-vars';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import {
  readSettingsEnvTab,
  settingsHref,
  type SettingsEnvTab,
} from '../../utils/project-route.utils';
import { selectExistingProjectEnvironments } from '../../utils/project-environment-list';
import { EnvironmentSettingsRevisionControl } from './environment-settings-revision-control';
import { EnvironmentSettingsScopeSelector } from './environment-settings-scope-selector';
import { EnvironmentSettingsTablist } from './environment-settings-tablist';
import { settingsDraftFromRevision, toConfigRevisionDraft } from './settings-env.model';
import { resourceDraftIssues } from './settings-resource-binding-preview.model';
import { findVariableBindingCollisions } from './settings-variable-binding.model';
import { renderEnvTab, type EnvTabContext } from './settings-env-tab-switch';
import { buildSettingsRevisionChanges } from './settings-revision-review.model';
import { useEnvironmentSettingsDraft } from './use-environment-settings-draft';

type DetailHook = ReturnType<typeof useProjectDetail>;
export function EnvironmentSettingsDetail({
  detail,
  environment,
  environments,
  onEnvironmentSelect,
}: {
  detail: DetailHook;
  environment: ProjectEnvironment;
  environments: ProjectEnvironment[];
  onEnvironmentSelect: (key: string) => void;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = detail.project?.id ?? '';
  const envTab = readSettingsEnvTab(searchParams);
  const tablistId = useId();
  const panelId = `${tablistId}-${envTab}-panel`;
  const governance = useEnvironmentConfigGovernance(
    environment,
    projectId,
    detail.loadProject,
    envTab === 'access',
  );
  const targets = useEnvironmentDeploymentTargets(environment.id, envTab === 'targets');
  const settings = useEnvironmentSettingsDraft(environment, governance.current);

  const selectTab = (next: SettingsEnvTab) => {
    const params = new URLSearchParams(searchParams);
    params.set('env', environment.key);
    params.set('envTab', next);
    router.replace(settingsHref(projectId, 'environments', params), { scroll: false });
  };

  const save = async () => {
    try {
      const result = await governance.save(toConfigRevisionDraft(settings.draft), {
        notifySaved: false,
      });
      feedback.success(t('configRevisionSaveSuccess'));
      return result;
    } catch (cause) {
      feedback.error(t('configRevisionSaveFailed'), {
        description: cause instanceof Error ? cause.message : undefined,
      });
      throw cause;
    }
  };
  const plainKeys = Object.keys(settings.plainVariables);
  const invalidVariableKeys = plainKeys.filter((key) => !isValidEnvKey(key));
  const collisions = findVariableBindingCollisions(plainKeys, settings.secrets, settings.resources);
  const resourceIssues = resourceDraftIssues(
    settings.resources,
    governance.current?.resourceReferences ?? [],
  );
  const draftInvalid =
    collisions.length > 0 || resourceIssues.length > 0 || invalidVariableKeys.length > 0;
  const changes = buildSettingsRevisionChanges(
    settingsDraftFromRevision(governance.current),
    settings.draft,
    {
      current: governance.current?.policyReferences,
      available: governance.policies,
    },
  );
  const blockers = [
    ...collisions.map((collision) =>
      t('configRevisionCollisionBlocker', {
        key: collision.key,
        sources: collision.sources.join(', '),
      }),
    ),
    ...resourceIssues.map((issue) => t('configRevisionResourceBlocker', { issue })),
    ...invalidVariableKeys.map((key) => t('configRevisionVariableKeyBlocker', { key })),
  ];

  const context: EnvTabContext = {
    detail,
    environment,
    targets,
    governance,
    plainVariables: settings.plainVariables,
    setPlainVariables: settings.setPlainVariables,
    secrets: settings.secrets,
    setSecrets: settings.setSecrets,
    policyIds: settings.policyIds,
    setPolicyIds: settings.setPolicyIds,
    policies: governance.policies,
    resources: settings.resources,
    setResources: settings.setResources,
    route: settings.route,
    setRoute: settings.setRoute,
    observability: settings.observability,
    setObservability: settings.setObservability,
    revision: governance.current,
    revisions: governance.data?.revisions ?? [],
    environments: selectExistingProjectEnvironments(detail.project?.environments),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
      <aside className="grid grid-cols-2 items-end gap-3 lg:block lg:space-y-[18px] lg:border-r lg:pr-5">
        <EnvironmentSettingsScopeSelector
          environments={environments}
          selected={environment.key}
          onSelect={onEnvironmentSelect}
        />
        <EnvironmentSettingsTablist
          tablistId={tablistId}
          panelId={panelId}
          selected={envTab}
          onSelect={selectTab}
        />
      </aside>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${tablistId}-${envTab}-tab`}
        className="min-w-0"
      >
        {renderEnvTab(envTab, context)}
      </div>

      {envTab === 'resources' || envTab === 'variables' ? (
        <EnvironmentSettingsRevisionControl
          environmentName={environment.name}
          summary={settings.summary}
          revisions={governance.data?.revisions ?? []}
          loading={governance.loading}
          invalid={draftInvalid}
          noChanges={settings.noDraftChanges}
          changes={changes}
          blockers={blockers}
          saving={governance.saving}
          error={governance.error}
          onSummaryChange={settings.setSummary}
          onSave={save}
          onResultDone={() => void detail.loadProject()}
        />
      ) : null}
    </div>
  );
}
