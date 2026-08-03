'use client';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { getEnvStatusLabelKey } from '../utils/run-labels';
import type { ProjectEnvironment } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function EnvBasics({
  environment,
  t,
}: {
  environment: ProjectEnvironment;
  t: ProjectsTranslator;
}) {
  const statusKey = getEnvStatusLabelKey(environment.status);
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{environment.key}</span>
        <StatusTag
          status={environment.status}
          label={statusKey ? t(statusKey) : t('envStatusUnknown')}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('envDetailSortOrder', { order: environment.sortOrder })}
      </p>
    </section>
  );
}

export function BoundServers({
  environment,
  t,
}: {
  environment: ProjectEnvironment;
  t: ProjectsTranslator;
}) {
  const servers = environment.serverBindings ?? [];
  if (servers.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('envDetailNoServers')}</p>;
  }
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envDetailServers')}
      </h4>
      <ul className="space-y-1 text-sm">
        {servers.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">
              <span className="font-medium">{b.server.name}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{b.server.host}</span>
            </span>
            {b.role ? (
              <span className="shrink-0 text-xs text-muted-foreground">{b.role}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ResourceCounts({
  environment,
  t,
}: {
  environment: ProjectEnvironment;
  t: ProjectsTranslator;
}) {
  const c = environment._count;
  if (!c) return null;
  const chips: Array<{ key: string; value: number }> = [
    { key: 'envCountServers', value: c.serverBindings ?? 0 },
    { key: 'envCountSites', value: c.sites ?? 0 },
    { key: 'envCountManaged', value: c.managedResources ?? 0 },
    { key: 'envCountInstances', value: c.resourceInstances ?? 0 },
    { key: 'envCountSecrets', value: c.secretKeys ?? 0 },
    { key: 'envCountCdn', value: c.cdnConfigs ?? 0 },
    { key: 'envCountRequests', value: c.resourceRequests ?? 0 },
    { key: 'envCountRuns', value: c.deploymentRuns ?? 0 },
  ];
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envDetailResourceCounts')}
      </h4>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="rounded-md border bg-muted/40 px-2 py-1 text-xs"
            title={t(chip.key)}
          >
            <span className="font-semibold">{chip.value}</span>{' '}
            <span className="text-muted-foreground">{t(chip.key)}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
