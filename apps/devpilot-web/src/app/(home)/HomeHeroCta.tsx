'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/hooks';

const LINK_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded-md border px-8 py-3 text-sm font-medium transition-colors hover:bg-accent';

/**
 * 首页 Hero 次要 CTA。
 *
 * 登录态只能客户端读取（useAuthStore），因此单独抽为 client 组件：
 * 未登录显示「登录」→ /login；已登录显示「进入控制台」→ /dashboard。
 *
 * 防止 hydration 闪烁：挂载前渲染与服务端首帧一致的不透明占位（同尺寸），
 * 挂载后再据登录态切换真实文案，避免已登录用户看到先 Login 后 Console 的跳变。
 */
export function HomeHeroCta() {
  const { isAuthenticated } = useAuthStore();
  const t = useTranslations('home');
  const tc = useTranslations('common');

  // useAuthStore 默认未登录；客户端 hydration 后才读取真实登录态。
  // mounted=false 时渲染占位，避免与 SSR 首帧文案冲突。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span className={LINK_CLASS} aria-hidden="true">
        &nbsp;
      </span>
    );
  }

  if (isAuthenticated) {
    return (
      <Link href="/dashboard" className={LINK_CLASS}>
        {t('ctaConsole')}
      </Link>
    );
  }

  return (
    <Link href="/login" className={LINK_CLASS}>
      {tc('login')}
    </Link>
  );
}
