'use client';

/**
 * 待办行动区
 *
 * 单一职责：突出展示需要用户立即处理的三类待办
 * （待我审批 / 24h 失败部署 / 活跃告警）。
 * 零计数的待办不渲染（避免占用空间），全部为零时降级为一行「一切正常」。
 * 配色统一走 design tokens（destructive / success），不再使用硬编码 Tailwind 调色板。
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';

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
      href: '/applications',
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

  const active = items.filter((item) => item.count > 0);

  return (
    <section aria-label={t('todoSectionTitle')}>
      <h2 className="mb-3 text-lg font-semibold">{t('todoSectionTitle')}</h2>
      {active.length === 0 ? (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {t('todoAllClear')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-2xl font-bold text-destructive">{item.count}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
              <span className="mt-2 inline-block text-xs font-medium text-destructive">
                {t('goHandle')} →
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
