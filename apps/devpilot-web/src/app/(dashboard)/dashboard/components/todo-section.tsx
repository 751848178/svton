'use client';

/**
 * 待办行动区
 *
 * 单一职责：突出展示需要用户立即处理的三类待办
 * （待我审批 / 24h 失败部署 / 活跃告警），全部为零时降级为一行「一切正常」。
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface TodoSectionProps {
  pendingApprovals: number;
  failedDeployments: number;
  firingAlerts: number;
}

export function TodoSection({ pendingApprovals, failedDeployments, firingAlerts }: TodoSectionProps) {
  const t = useTranslations('dashboard');

  const items = [
    {
      href: '/operation-approvals',
      count: pendingApprovals,
      label: t('todoPendingApprovals'),
      hint: t('todoPendingApprovalsHint'),
    },
    {
      href: '/projects',
      count: failedDeployments,
      label: t('todoFailedDeployments'),
      hint: t('todoFailedDeploymentsHint'),
    },
    {
      href: '/monitoring',
      count: firingAlerts,
      label: t('todoFiringAlerts'),
      hint: t('todoFiringAlertsHint'),
    },
  ];

  const hasTodo = items.some((item) => item.count > 0);

  return (
    <section aria-label={t('todoSectionTitle')}>
      <h2 className="mb-3 text-lg font-semibold">{t('todoSectionTitle')}</h2>
      {hasTodo ? (
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-lg border p-4 transition-shadow hover:shadow-md',
                item.count > 0
                  ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
                  : 'bg-card opacity-70',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <span
                  className={cn(
                    'text-2xl font-bold',
                    item.count > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                  )}
                >
                  {item.count}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.count > 0 ? item.hint : t('todoItemClear')}
              </p>
              {item.count > 0 ? (
                <span className="mt-2 inline-block text-xs font-medium text-red-600 dark:text-red-400">
                  {t('goHandle')} →
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400">
          {t('todoAllClear')}
        </div>
      )}
    </section>
  );
}
