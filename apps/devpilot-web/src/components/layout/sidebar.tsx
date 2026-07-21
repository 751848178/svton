'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/hooks';
import { filterNavSectionsByRole, findActiveNavItem, navigationSections } from './navigation-items';
import { NavIcon } from './nav-icons';

export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { user } = useAuthStore();

  // 渲染层按角色过滤:/admin/* 项仅对 admin 可见
  const visibleSections = filterNavSectionsByRole(navigationSections, user?.role);

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:block">
      <div className="space-y-4 py-4">
        {visibleSections.map((section) => {
          // 同分区多项前缀命中时只高亮最长匹配项
          const activeItem = findActiveNavItem(pathname, section.items);
          return (
            <div
              key={section.titleKey}
              className="px-3 py-2"
            >
              <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">{t(section.titleKey)}</h2>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
                      activeItem?.href === item.href
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <NavIcon
                      name={item.icon}
                      className="mr-3 h-4 w-4 shrink-0"
                    />
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
