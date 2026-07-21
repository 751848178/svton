'use client';

/**
 * 我的资源申请近况
 *
 * 单一职责：最近 N 条资源申请（标题 / 状态徽章 / 时间），链到资源申请页。
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { DashboardResourceRequest } from '../types';

export function MyResourceRequests({ requests }: { requests: DashboardResourceRequest[] }) {
  const t = useTranslations('dashboard');

  return (
    <section aria-label={t('myRequestsTitle')} className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('myRequestsTitle')}</h2>
        <Link href="/resource-requests" className="text-sm text-primary hover:underline">
          {t('viewAll')}
        </Link>
      </div>
      {requests.length === 0 ? (
        <EmptyState text={t('emptyRequests')} />
      ) : (
        <ul className="divide-y">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href="/resource-requests"
                className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{request.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTimeMinute(request.createdAt)}
                  </p>
                </div>
                <StatusTag status={request.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
