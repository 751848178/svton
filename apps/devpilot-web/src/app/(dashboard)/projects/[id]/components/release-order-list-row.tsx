'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
import type { ReleaseOrderListItem } from '../types/release-order-list.types';
import { releaseOrderStatusTone } from '../utils/release-order.utils';

export function ReleaseOrderListRow({
  item,
  onOpen,
}: {
  item: ReleaseOrderListItem;
  onOpen: () => void;
}) {
  const t = useTranslations('projects');
  const manifest = item.build.recentSuccessfulManifest;
  const deployment = item.deployment.latest;
  return (
    <article className="grid gap-5 border-t p-5 first:border-t-0 lg:grid-cols-[minmax(240px,1.3fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(230px,1.2fr)]">
      <section aria-label={t('releaseOrderColumnOrder')}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{item.releaseVersion}</h3>
          <StatusTag
            status={releaseOrderStatusTone(item.status)}
            label={t(`releaseOrderStatus${capitalize(item.status)}`)}
          />
        </div>
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
          {item.source.commitSha
            ? `${item.source.branch ?? '—'}@${item.source.commitSha.slice(0, 8)}`
            : t('releaseOrderSourcePending', { branch: item.source.branch ?? '—' })}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{item.note || t('releaseOrderNoNote')}</p>
      </section>

      <section aria-label={t('releaseOrderColumnBuild')}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('releaseOrderColumnBuild')}
        </p>
        <p className="mt-2 font-medium">
          {t('releaseOrderBuildCount', { count: item.build.count })}
        </p>
        {manifest ? (
          <p className="mt-1 break-all text-xs text-muted-foreground">
            <span title={manifest.id}>
              {t('releaseOrderRecentManifest', {
                revision: manifest.buildRevision,
                manifest: shortId(manifest.id),
              })}
            </span>
            <span
              className="block font-mono"
              title={manifest.digest}
            >
              {shortDigest(manifest.digest)}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{t('releaseOrderNoManifest')}</p>
        )}
      </section>

      <section aria-label={t('releaseOrderColumnDeployment')}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('releaseOrderColumnDeployment')}
        </p>
        <p className="mt-2 font-medium">
          {t('releaseOrderDeploymentCount', { count: item.deployment.count })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {deployment
            ? `${deployment.environmentName} · ${executionStatus(t, deployment.status)}`
            : t('releaseOrderNoDeployment')}
        </p>
      </section>

      <section aria-label={t('releaseOrderColumnLastExecution')}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('releaseOrderColumnLastExecution')}
        </p>
        <p className="mt-2 font-medium">
          {t(`releaseOrderListStep${capitalize(item.lastExecution.step)}`)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {executionStatus(t, item.lastExecution.status)} · {formatDateTime(item.lastExecutedAt)}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onOpen}
        >
          {t('viewReleaseOrder')}
        </Button>
      </section>
    </article>
  );
}

function executionStatus(t: ReturnType<typeof useTranslations>, status: string) {
  const keys: Record<string, string> = {
    created: 'Created',
    queued: 'Queued',
    running: 'Running',
    succeeded: 'Succeeded',
    failed: 'Failed',
    canceled: 'Canceled',
    completed: 'Completed',
    blocked: 'Blocked',
    pending: 'Pending',
    awaiting_approval: 'AwaitingApproval',
  };
  const key = keys[status];
  return key ? t(`releaseExecutionStatus${key}`) : status;
}

function shortId(value: string) {
  return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}

function shortDigest(value: string) {
  return value.length > 24 ? `${value.slice(0, 20)}…` : value;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
