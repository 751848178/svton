'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Popover } from '@svton/ui';
import { cn } from '@/lib/utils';
import { findActiveNavItem, isNavItemActive, type NavigationSection } from '../navigation-items';
import { NavIcon } from '../nav-icons';
import { SidebarItem } from './sidebar-item';

interface SidebarGroupProps {
  section: NavigationSection;
  pathname: string;
  /** 非空时表示搜索态:所有项(含 secondary)直接展开渲染。 */
  query: string;
}

/** 单个分组:主项常驻 + secondary 项收纳到「更多」Popover。 */
export function SidebarGroup({ section, pathname, query }: SidebarGroupProps) {
  const t = useTranslations('nav');
  const searching = query.length > 0;
  const activeItem = findActiveNavItem(pathname, section.items);

  // 搜索态:展开所有项;否则主项常驻 + 活跃的 secondary 项也常驻
  const primaryItems = searching
    ? section.items
    : section.items.filter((item) => !item.secondary || isNavItemActive(pathname, item));
  const moreItems = searching
    ? []
    : section.items.filter(
        (item) => item.secondary && !isNavItemActive(pathname, item),
      );

  if (primaryItems.length === 0 && moreItems.length === 0) return null;

  return (
    <div className="space-y-1 px-3 py-2">
      <h2 className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t(section.titleKey)}
      </h2>
      <nav
        aria-label={t(section.titleKey)}
        className="space-y-0.5"
      >
        {primaryItems.map((item) => (
          <SidebarItem
            key={item.href}
            item={item}
            active={activeItem?.href === item.href}
          />
        ))}
      </nav>
      {moreItems.length > 0 ? (
        <div className="px-3 pt-1">
          <Popover
            placement="right"
            triggerClassName="block w-full"
            content={
              <div className="w-44 space-y-0.5">
                {moreItems.map((item) => (
                  <SidebarMoreItem
                    key={item.href}
                    item={item}
                    active={isNavItemActive(pathname, item)}
                  />
                ))}
              </div>
            }
          >
            <button
              type="button"
              aria-label={`${t(section.titleKey)} ${t('moreLabel')}`}
              className="flex h-7 w-full items-center gap-2 rounded-md px-3 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <span aria-hidden="true">⋯</span>
              <span>{t('more')} ({moreItems.length})</span>
            </button>
          </Popover>
        </div>
      ) : null}
    </div>
  );
}

/** 「更多」浮层内的次项条目。 */
function SidebarMoreItem({
  item,
  active,
}: {
  item: NavigationSection['items'][number];
  active: boolean;
}) {
  const t = useTranslations('nav');
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
        active
          ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
          : 'text-popover-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <NavIcon
        name={item.icon}
        className="h-3.5 w-3.5 shrink-0"
      />
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  );
}
