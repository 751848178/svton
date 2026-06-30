'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/hooks';

/**
 * 首页「欢迎回来」客户端区块。
 *
 * 仅这部分需要客户端：读 useAuthStore() 的登录态。
 * 其余静态营销内容留在 server 页面（page.tsx），避免整页 client。
 */
export function HomeGreeting() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return null;

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 text-center text-2xl font-bold">
          欢迎回来，{user?.name || user?.email}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <QuickLink href="/projects/new" title="创建项目" description="开始新项目配置" />
          <QuickLink href="/resources" title="资源管理" description="管理资源凭证" />
          <QuickLink href="/presets" title="配置预设" description="查看保存的预设" />
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
    <Link href={href} className="rounded-lg border p-4 transition-colors hover:border-primary">
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
