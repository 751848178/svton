'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ActionMenu, StatusTag } from '@/components/ui';
import type { Site } from '@/app/(dashboard)/sites/types';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { EnvironmentConfigRevision } from '../types/environment-config-revision.types';
import type { ProjectApplication } from '../types';
import {
  domainAliases,
  domainEvidence,
  domainTarget,
  tlsLabel,
} from './project-domain-entry.model';
import { PROJECT_TABLE_CLASS } from './project-workbench-surface';

export function ProjectDomainsTable(props: {
  items: Site[];
  revision: EnvironmentConfigRevision | null;
  applications: ProjectApplication[];
  onOpen: (site: Site) => void;
  onEdit: (site: Site) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations('projects');
  return (
    <table className={`${PROJECT_TABLE_CLASS} min-w-[1120px]`}>
      <thead>
        <tr>
          <th className="px-4 py-3 font-medium">{t('domainColumnDomain')}</th>
          <th className="px-4 py-3 font-medium">{t('domainColumnEnvironment')}</th>
          <th className="px-4 py-3 font-medium">{t('domainColumnTarget')}</th>
          <th className="px-4 py-3 font-medium">TLS</th>
          <th className="px-4 py-3 font-medium">{t('domainColumnEvidence')}</th>
          <th className="px-4 py-3 font-medium">{t('releaseOrderColumnStatus')}</th>
          <th className="px-4 py-3 text-right font-medium">{t('releaseOrderColumnActions')}</th>
        </tr>
      </thead>
      <tbody>
        {props.items.map((site) => {
          const aliases = domainAliases(site);
          const target = domainTarget(site, props.revision, props.applications);
          const evidence = domainEvidence(site);
          return (
            <tr key={site.id}>
              <td className="px-4 py-3">
                <p className="font-medium">{site.primaryDomain}</p>
                <p className="max-w-64 truncate text-xs text-muted-foreground">
                  {aliases.length > 0
                    ? t('domainAliasesValue', { aliases: aliases.join(', ') })
                    : t('domainAliasesEmpty')}
                </p>
              </td>
              <td className="px-4 py-3">{site.environment?.name ?? '—'}</td>
              <td className="px-4 py-3">
                <p className="font-mono text-xs">{target.primary}</p>
                {target.secondary ? (
                  <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">
                    {target.secondary}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3">{tlsLabel(site, props.revision)}</td>
              <td className="px-4 py-3">
                <EvidenceLine
                  label="DNS"
                  status={evidence.dnsStatus}
                  checkedAt={evidence.dnsCheckedAt}
                  unavailable={t('domainEvidenceUnavailable')}
                />
                <EvidenceLine
                  label={t('domainProbeLabel')}
                  status={evidence.probeStatus}
                  checkedAt={evidence.probeCheckedAt}
                  unavailable={t('domainEvidenceUnavailable')}
                />
              </td>
              <td className="px-4 py-3">
                <StatusTag
                  status={site.status}
                  label={site.status}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Action
                    label={t('domainActionDetails')}
                    onClick={() => props.onOpen(site)}
                  />
                  <ActionMenu
                    triggerLabel={t('moreActions')}
                    groups={[
                      {
                        items: [
                          {
                            key: 'edit',
                            label: t('domainActionEdit'),
                            onSelect: () => props.onEdit(site),
                          },
                          {
                            key: 'delete',
                            label: t('domainActionDelete'),
                            danger: true,
                            onSelect: () => props.onDelete(site.id),
                          },
                        ],
                      },
                    ]}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function EvidenceLine(props: {
  label: string;
  status: string | null;
  checkedAt: string | null;
  unavailable: string;
}) {
  const value = props.status || props.unavailable;
  return (
    <p
      className="text-xs"
      title={props.checkedAt ? formatDateTimeMinute(props.checkedAt) : undefined}
    >
      <span className="text-muted-foreground">{props.label}</span>{' '}
      <span className={props.status ? 'font-medium' : 'text-muted-foreground'}>{value}</span>
    </p>
  );
}

function Action(props: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      className={
        props.danger
          ? 'min-h-11 text-xs font-medium text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline'
          : 'min-h-11 text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline'
      }
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}
