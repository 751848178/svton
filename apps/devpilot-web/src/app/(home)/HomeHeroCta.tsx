'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/hooks';

/**
 * 首页 Hero 次要 CTA。
 *
 * 登录态只能客户端读取（useAuthStore），因此单独抽为 client 组件：
 * 未登录显示「登录」→ /login；已登录显示「进入控制台」→ /dashboard。
 * 与 HomeGreeting 同一模式，server 首帧按未登录渲染，hydration 后切换。
 */
export function HomeHeroCta() {
  const { isAuthenticated } = useAuthStore();
  const t = useTranslations('home');
  const tc = useTranslations('common');

  if (isAuthenticated) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-md border px-8 py-3 text-sm font-medium transition-colors hover:bg-accent"
      >
        {t('ctaConsole')}
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className="inline-flex items-center justify-center rounded-md border px-8 py-3 text-sm font-medium transition-colors hover:bg-accent"
    >
      {tc('login')}
    </Link>
  );
}
