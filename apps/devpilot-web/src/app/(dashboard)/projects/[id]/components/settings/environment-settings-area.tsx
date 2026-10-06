'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import { selectExistingProjectEnvironments } from '../../utils/project-environment-list';
import {
  readSettingsEnvKey,
  readSettingsEnvTab,
  settingsHref,
} from '../../utils/project-route.utils';
import { EnvironmentSettingsDetail } from './environment-settings-detail';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvironmentSettingsArea({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const project = detail.project;
  const environments = selectExistingProjectEnvironments(project?.environments);
  const requestedKey = readSettingsEnvKey(searchParams);
  const envTab = readSettingsEnvTab(searchParams);
  const defaultEnvironment =
    environments.find((environment) => environment.baselineRole === 'staging') ?? environments[0];
  const active =
    environments.find((environment) => environment.key === requestedKey) ??
    defaultEnvironment ??
    null;
  const projectId = project?.id;
  const activeKey = active?.key;
  const routeQuery = searchParams.toString();
  useEffect(() => {
    if (!projectId || !activeKey) return;
    const next = new URLSearchParams(routeQuery);
    if (
      next.get('section') === 'environments' &&
      next.get('env') === activeKey &&
      next.get('envTab') === envTab
    )
      return;
    next.set('env', activeKey);
    next.set('envTab', envTab);
    router.replace(settingsHref(projectId, 'environments', next), { scroll: false });
  }, [activeKey, envTab, projectId, routeQuery, router]);
  if (!project) return null;
  const selectEnvironment = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('env', key);
    next.set('envTab', envTab);
    router.replace(settingsHref(project.id, 'environments', next), { scroll: false });
  };

  return active ? (
    <EnvironmentSettingsDetail
      key={active.id}
      detail={detail}
      environment={active}
      environments={environments}
      onEnvironmentSelect={selectEnvironment}
    />
  ) : (
    <section>
      <EmptyState text={t('noEnvironments')} />
    </section>
  );
}
