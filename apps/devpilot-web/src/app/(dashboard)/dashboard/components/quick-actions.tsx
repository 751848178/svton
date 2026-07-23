'use client';

/**
 * 快捷操作区
 *
 * 单一职责：三个高频入口链接卡（新建项目 / 申请资源 / 添加凭证）。
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function QuickActions() {
  const t = useTranslations('dashboard');

  const actions = [
    {
      href: '/projects/new',
      title: t('quickNewProject'),
      description: t('quickNewProjectDescription'),
    },
    {
      href: '/resource-requests',
      title: t('quickRequestResource'),
      description: t('quickRequestResourceDescription'),
    },
    {
      href: '/resources',
      title: t('quickAddCredential'),
      description: t('quickAddCredentialDescription'),
    },
  ];

  return (
    <section aria-label={t('quickActionsTitle')}>
      <h2 className="mb-3 text-lg font-semibold">{t('quickActionsTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.href + action.title}
            href={action.href}
            className="rounded-lg border bg-card p-4 transition-colors hover:border-primary"
          >
            <h3 className="font-medium">{action.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
