'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { Site } from '@/app/(dashboard)/sites/types';

export function ProjectDomainsTable(props: {
  items: Site[];
  onEdit: (site: Site) => void;
  onPlan: (id: string) => void;
  onDelete: (id: string) => void;
  /** 正在生成配置预览的站点 id（DOM-3：按钮给出加载反馈）。 */
  planningSiteId?: string | null;
}) {
  const t = useTranslations('projects');
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">{t('domainColumnDomain')}</th>
            <th className="px-4 py-3 font-medium">{t('domainColumnEnvironment')}</th>
            <th className="px-4 py-3 font-medium">{t('domainColumnTarget')}</th>
            <th className="px-4 py-3 font-medium">TLS</th>
            <th className="px-4 py-3 font-medium">{t('releaseOrderColumnStatus')}</th>
            <th className="px-4 py-3 text-right font-medium">{t('releaseOrderColumnActions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {props.items.map((site) => (
            <tr key={site.id}>
              <td className="px-4 py-3">
                <p className="font-medium">{site.primaryDomain}</p>
                <p className="text-xs text-muted-foreground">{site.name}</p>
              </td>
              <td className="px-4 py-3">{site.environment?.name ?? '—'}</td>
              <td className="px-4 py-3">
                {site.server ? `${site.server.name} · ${site.server.host}` : '—'}
              </td>
              <td className="px-4 py-3">{readTls(site.tls)}</td>
              <td className="px-4 py-3">
                <StatusTag
                  status={site.status}
                  label={site.status}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-3">
                  <Action
                    label={t('domainActionEdit')}
                    onClick={() => props.onEdit(site)}
                  />
                  <Action
                    label={
                      props.planningSiteId === site.id
                        ? t('domainActionPreviewLoading')
                        : t('domainActionPreview')
                    }
                    disabled={props.planningSiteId === site.id}
                    onClick={() => props.onPlan(site.id)}
                  />
                  <Action
                    label={t('domainActionDelete')}
                    danger
                    onClick={() => props.onDelete(site.id)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          ? 'text-xs font-medium text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline'
          : 'text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline'
      }
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

function readTls(value: unknown) {
  if (!value || typeof value !== 'object') return '—';
  const record = value as Record<string, unknown>;
  return record.enabled === false ? 'HTTP' : String(record.type || record.status || 'TLS');
}
