'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/hooks';
import { filterNavSectionsByRole, navigationSections } from '../navigation-items';
import { SidebarGroup } from './sidebar-group';
import { SidebarUserCard } from './sidebar-user-card';

/**
 * Sidebar 容器:品牌头 + 搜索 + 分组列表 + 底部用户卡。
 * 借鉴 twgg admin 视觉骨架,数据源仍走 devpilot-web 的 navigationSections + i18n。
 */
export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

  // 角色门控:/admin/* 项仅对 admin 可见
  const roleFiltered = filterNavSectionsByRole(navigationSections, user?.role);

  // 搜索过滤:labelKey 翻译后小写匹配 + href 匹配;空分组整体隐藏
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return roleFiltered;
    return roleFiltered
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const label = t(item.labelKey).toLowerCase();
          return label.includes(normalizedQuery) || item.href.toLowerCase().includes(normalizedQuery);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [roleFiltered, normalizedQuery, t]);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
      <div className="px-6 pb-4 pt-7">
        <p className="text-lg font-bold text-foreground">Devpilot</p>
        <p className="text-xs font-medium text-muted-foreground">{t('sidebarSubtitle')}</p>
      </div>

      <div className="px-4 pb-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchMenu')}
          aria-label={t('searchMenu')}
          className="h-8 w-full rounded-md border border-sidebar-border bg-background pl-3 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="scrollbar-none flex-1 overflow-y-auto py-2">
        <div className="space-y-1">
          {visibleSections.map((section) => (
            <SidebarGroup
              key={section.titleKey}
              section={section}
              pathname={pathname}
              query={normalizedQuery}
            />
          ))}
          {visibleSections.length === 0 ? (
            <p className="px-6 py-4 text-xs text-muted-foreground">{t('searchMenu')}…</p>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <SidebarUserCard />
      </div>
    </aside>
  );
}
