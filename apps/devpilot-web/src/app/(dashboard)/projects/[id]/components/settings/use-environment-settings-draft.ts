'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProjectEnvironment } from '../../types';
import type {
  EnvironmentConfigResourceReference,
  EnvironmentConfigRevision,
  EnvironmentConfigSecretReference,
} from '../../types/environment-config-revision.types';
import {
  EMPTY_SETTINGS_ENVIRONMENT_DRAFT,
  settingsDraftFromRevision,
  type SettingsRouteDraft,
} from './settings-env.model';

export function useEnvironmentSettingsDraft(
  environment: ProjectEnvironment,
  revision: EnvironmentConfigRevision | null,
) {
  const [plainVariables, setPlainVariables] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<EnvironmentConfigSecretReference[]>([]);
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [resources, setResources] = useState<EnvironmentConfigResourceReference[]>([]);
  const [route, setRoute] = useState<SettingsRouteDraft>(EMPTY_SETTINGS_ENVIRONMENT_DRAFT.route);
  const [summary, setSummary] = useState('');
  const [observability, setObservability] = useState<'' | 'local_acceptance_v1'>('');
  const [baselineKey, setBaselineKey] = useState('');

  useEffect(() => {
    const draft = settingsDraftFromRevision(revision) ?? {
      ...EMPTY_SETTINGS_ENVIRONMENT_DRAFT,
      plainVariables: readPlainVariables(environment),
    };
    setPlainVariables(draft.plainVariables);
    setSecrets(draft.secrets);
    setPolicyIds(draft.policyIds);
    setResources(draft.resources);
    setRoute(draft.route);
    setObservability(draft.observability.profile);
    setSummary('');
    setBaselineKey(serialized(draft));
  }, [environment.id, revision?.id]);

  const draft = useMemo(
    () => ({
      plainVariables,
      secrets,
      policyIds,
      resources,
      route,
      summary,
      observability: { profile: observability },
    }),
    [observability, plainVariables, policyIds, resources, route, secrets, summary],
  );

  return {
    draft,
    noDraftChanges: Boolean(baselineKey) && serialized(draft) === baselineKey,
    plainVariables,
    setPlainVariables,
    secrets,
    setSecrets,
    policyIds,
    setPolicyIds,
    resources,
    setResources,
    route,
    setRoute,
    summary,
    setSummary,
    observability,
    setObservability,
  };
}

function readPlainVariables(environment: ProjectEnvironment) {
  const source = environment.config?.envVars;
  if (!source || typeof source !== 'object') return {};
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

function serialized(draft: {
  plainVariables: Record<string, string>;
  secrets: EnvironmentConfigSecretReference[];
  policyIds: string[];
  resources: EnvironmentConfigResourceReference[];
  route: SettingsRouteDraft;
  observability: { profile: string };
}) {
  return JSON.stringify([
    draft.plainVariables,
    draft.secrets,
    draft.policyIds,
    draft.resources,
    draft.route,
    draft.observability.profile,
  ]);
}
