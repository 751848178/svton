'use client';

/**
 * 最近部署时间线
 *
 * 单一职责：最近 N 条部署运行列表（项目 / 状态 / 时间），
 * 有项目上下文时链到项目详情，否则链到项目列表。
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { DashboardDeploymentRun } from '../types';

export function RecentDeployments({ runs }: { runs: DashboardDeploymentRun[] }) {
  const t = useTranslations('dashboard');

  return (
    <section aria-label={t('recentDeploymentsTitle')} className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('recentDeploymentsTitle')}</h2>
        <Link href="/applications" className="text-sm text-primary hover:underline">
          {t('viewAll')}
        </Link>
      </div>
      {runs.length === 0 ? (
        <EmptyState text={t('emptyDeployments')} />
      ) : (
        <ul className="divide-y">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={run.project ? `/projects/${run.project.id}` : '/projects'}
                className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {run.project?.name ?? t('unknownProject')}
                    {run.projectEnvironment ? (
                      <span className="ml-1 text-muted-foreground">· {run.projectEnvironment.name}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTimeMinute(run.startedAt)}
                    {run.branch ? <span className="ml-2">{run.branch}</span> : null}
                  </p>
                </div>
                <StatusTag status={run.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
