'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { Select } from '@/components/ui';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import { selectExistingProjectEnvironments } from '../../utils/project-environment-list';
import { readSettingsEnvKey, settingsHref } from '../../utils/project-route.utils';
import { EnvironmentSettingsDetail } from './environment-settings-detail';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvironmentSettingsArea({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const project = detail.project;
  if (!project) return null;
  const environments = selectExistingProjectEnvironments(project.environments);
  const requestedKey = readSettingsEnvKey(searchParams);
  const defaultEnvironment =
    environments.find((environment) => environment.baselineRole === 'production') ??
    environments[0];
  const active =
    environments.find((environment) => environment.key === requestedKey) ??
    defaultEnvironment ??
    null;
  const selectEnvironment = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('env', key);
    router.replace(settingsHref(project.id, 'environments', next), { scroll: false });
  };
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t('projectConfigurationTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('projectConfigurationDescription')}
          </p>
        </div>
        {active ? (
          <label className="flex items-center gap-3 text-sm">
            <span className="font-medium text-muted-foreground">
              {t('currentEnvironmentLabel')}
            </span>
            <Select
              className="min-w-64"
              value={active.key}
              onChange={(event) => selectEnvironment(event.target.value)}
            >
              {environments.map((environment) => (
                <option
                  key={environment.id}
                  value={environment.key}
                >
                  {environment.name} ({environment.key})
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>
      {active ? (
        <EnvironmentSettingsDetail
          key={active.id}
          detail={detail}
          environment={active}
        />
      ) : (
        <EmptyState text={t('noEnvironments')} />
      )}
    </section>
  );
}
