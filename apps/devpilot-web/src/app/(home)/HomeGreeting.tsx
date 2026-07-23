'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/hooks';

/**
 * 首页「欢迎回来」客户端区块。
 *
 * 仅这部分需要客户端：读 useAuthStore() 的登录态。
 * 其余静态营销内容留在 server 页面（page.tsx），避免整页 client。
 *
 * 视觉节奏与 page.tsx 对齐：py-20 + max-w-5xl；卡片统一加 bg-card。
 */
export function HomeGreeting() {
  const { isAuthenticated, user } = useAuthStore();
  const t = useTranslations('home');
  const td = useTranslations('dashboard');

  if (!isAuthenticated) return null;

  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-8 text-center text-2xl font-bold">
          {t('welcomeBack', { name: user?.name || user?.email || '' })}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/dashboard" title={td('enterConsole')} description={td('enterConsoleDescription')} />
          <QuickLink href="/projects/new" title={t('quickCreateProject')} description={t('quickCreateProjectDesc')} />
          <QuickLink href="/resources" title={t('quickResources')} description={t('quickResourcesDesc')} />
          <QuickLink href="/presets" title={t('quickPresets')} description={t('quickPresetsDesc')} />
        </div>
      </div>
    </section>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-card p-4 transition-colors hover:border-primary"
    >
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
