'use client';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { getEnvStatusLabelKey } from '../utils/run-labels';
import { ResourceCountChips } from './environment-resource-count-chips';
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
  if (!environment._count) return null;
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envDetailResourceCounts')}
      </h4>
      <ResourceCountChips
        environment={environment}
        t={t}
      />
    </section>
  );
}
