'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { CreateEnvironmentConfigRevisionResult } from '../../types/environment-config-revision.types';

export function EnvironmentSettingsRevisionResult({
  result,
}: {
  result: CreateEnvironmentConfigRevisionResult;
}) {
  const t = useTranslations('projects');
  const actor = result.revision.createdBy ?? result.auditEvent.actor;
  const facts = [
    [t('configRevisionResultRevision'), `R${result.revision.revision}`],
    [t('configRevisionResultHash'), result.revision.snapshotHash],
    [t('configRevisionResultCreatedAt'), formatDateTimeMinute(result.revision.createdAt)],
    [t('configRevisionResultCreatedBy'), actor?.name || actor?.email || '—'],
    [t('configRevisionResultAuditId'), result.auditEvent.id],
    [t('configRevisionResultAuditStatus'), result.auditEvent.status],
    [t('configRevisionResultAuditRisk'), result.auditEvent.risk],
    [t('configRevisionResultAuditTime'), formatDateTimeMinute(result.auditEvent.occurredAt)],
  ];
  return (
    <div className="space-y-4">
      <Alert tone="info">{t('configRevisionResultSuccess')}</Alert>
      <dl className="grid gap-3 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-lg border p-3 shadow-sm"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-all text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="rounded-lg border p-3">
        <h3 className="text-sm font-semibold">{t('configRevisionResultAuditSummary')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{result.auditEvent.summary || '—'}</p>
        <p className="mt-2 break-all text-xs text-muted-foreground">
          {result.auditEvent.action} · {result.auditEvent.targetType} ·{' '}
          {result.auditEvent.targetId || '—'}
        </p>
      </section>
    </div>
  );
}
