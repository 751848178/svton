'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const sidebarItems = [
  {
    title: '项目',
    items: [
      { href: '/projects/new', label: '创建项目' },
      { href: '/projects', label: '我的项目' },
    ],
  },
  {
    title: '基础设施',
    items: [
      { href: '/servers', label: '服务器管理' },
      { href: '/proxy-configs', label: '代理配置' },
      { href: '/cdn-configs', label: 'CDN 配置' },
    ],
  },
  {
    title: '资源',
    items: [
      { href: '/resources', label: '资源凭证' },
      { href: '/keys', label: '密钥中心' },
    ],
  },
  {
    title: '配置',
    items: [
      { href: '/presets', label: '配置预设' },
      { href: '/git', label: 'Git 连接' },
    ],
  },
  {
    title: '团队',
    items: [
      { href: '/teams', label: '团队管理' },
    ],
  },
  {
    title: '管理员',
    items: [
      { href: '/admin/resource-pools', label: '资源池管理' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-background">
      <div className="space-y-4 py-4">
        {sidebarItems.map((section) => (
          <div key={section.title} className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
