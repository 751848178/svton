'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { ApplicationServiceItem } from '../types';
import {
  formatDate,
  getOperationLabel,
  getOperationStatusLabel,
} from '../utils';

export function ServiceRecentOperations({
  service,
}: {
  service: ApplicationServiceItem;
}) {
  const t = useTranslations('applications');
  if (!service.operationRuns?.length) return null;
  return (
    <div className="mt-3 rounded-md bg-muted/50 p-3">
      <div className="text-xs font-medium text-muted-foreground">{t('recentOps')}</div>
      <div className="mt-2 space-y-2">
        {service.operationRuns.slice(0, 3).map((run) => (
          <div
            key={run.id}
            className="flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{getOperationLabel(t, run.action)}</span>
              <StatusTag
                status={run.status}
                label={getOperationStatusLabel(t, run.status)}
              />
              <span className="text-muted-foreground">
                {run.dryRun ? t('modeDryRun') : t('modeLive')}
              </span>
              {run.serverExecutionJob ? (
                <Link href="/execution-governance" className="text-primary hover:underline">
                  {t('jobLabel')} #{run.serverExecutionJob.id.slice(0, 8)} ·{' '}
                  {getOperationStatusLabel(t, run.serverExecutionJob.status)}
                </Link>
              ) : null}
              {run.error ? (
                <span className="max-w-[16rem] truncate text-destructive" title={run.error}>
                  {run.error}
                </span>
              ) : null}
            </div>
            <span className="text-muted-foreground">{formatDate(run.startedAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
