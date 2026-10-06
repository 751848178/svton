'use client';

import Link from 'next/link';
import { Warning } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { ProjectDomainGapFact } from './project-domain-gap.model';
import { PROJECT_COMPACT_ACTION_CLASS } from './project-workbench-surface';

export function ProjectDomainGapNotice(props: { facts: ProjectDomainGapFact[]; href: string }) {
  const t = useTranslations('projects');
  return (
    <div
      className="border-b p-4 text-sm"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-2 font-medium text-amber-700">
          <Warning
            size={18}
            weight="fill"
            aria-hidden="true"
          />
          {t('productionEntryMissing')}
        </span>
        <Link
          href={props.href}
          className={`${PROJECT_COMPACT_ACTION_CLASS} font-medium text-primary hover:underline`}
        >
          {t('addDomainEntry')} →
        </Link>
      </div>
      {props.facts.length > 0 ? (
        <ul className="mt-2 space-y-1 pl-6 text-xs text-muted-foreground">
          {props.facts.map((fact) => (
            <li key={fact.key}>{factLabel(fact, t)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 pl-6 text-xs text-muted-foreground">
          {t('productionEntryGapNoEvidence')}
        </p>
      )}
    </div>
  );
}

function factLabel(fact: ProjectDomainGapFact, t: ReturnType<typeof useTranslations<'projects'>>) {
  return t('productionEntryGapFact', {
    source: t(fact.source === 'route_revision' ? 'domainGapRevision' : 'domainGapActiveService'),
    domain: fact.domain ?? t('domainGapDomainUnconfigured'),
    component: fact.component ?? t('domainGapComponentUnavailable'),
    port: fact.port ?? t('domainGapPortUnconfigured'),
    path: fact.path ?? t('domainGapPathUnconfigured'),
  });
}
