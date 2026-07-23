'use client';

import { useState } from 'react';
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

/** 通用三点(更多)图标,16x16,stroke 制。 */
function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

/**
 * 单个分组:常驻主项 + secondary 项收纳到分组标题右侧的三点「更多」Popover。
 *
 * 活跃 secondary 项不内联到主列表(避免页面来回跳动);
 * 它只会在「更多」面板里以选中态呈现,保持主列表稳定。
 */
export function SidebarGroup({ section, pathname, query }: SidebarGroupProps) {
  const t = useTranslations('nav');
  const searching = query.length > 0;
  const activeItem = findActiveNavItem(pathname, section.items);
  const [moreOpen, setMoreOpen] = useState(false);

  const secondaryItems = section.items.filter((item) => item.secondary);

  // 搜索态:展开所有项;否则只渲染非 secondary 的主项。
  const primaryItems = searching ? section.items : section.items.filter((item) => !item.secondary);
  const moreItems = searching ? [] : secondaryItems;

  if (primaryItems.length === 0 && moreItems.length === 0) return null;

  const hasActiveSecondary =
    !!activeItem && secondaryItems.some((item) => item.href === activeItem.href);

  return (
    <div className="space-y-1 px-3 py-2">
      <div className="flex items-center justify-between pr-1.5">
        <h2 className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t(section.titleKey)}
        </h2>
        {moreItems.length > 0 ? (
          <Popover
            visible={moreOpen}
            onVisibleChange={setMoreOpen}
            placement="right"
            content={
              <div className="w-44 space-y-0.5">
                {moreItems.map((item) => (
                  <SidebarMoreItem
                    key={item.href}
                    item={item}
                    active={isNavItemActive(pathname, item)}
                    onNavigate={() => setMoreOpen(false)}
                  />
                ))}
              </div>
            }
          >
            <button
              type="button"
              aria-label={`${t(section.titleKey)} ${t('moreLabel')}`}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
                moreOpen && 'bg-sidebar-accent text-sidebar-foreground',
              )}
            >
              <MoreIcon className="h-4 w-4" />
            </button>
          </Popover>
        ) : null}
      </div>
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
        {/* 活跃 secondary 项不在主列表渲染;仅在标题旁的三点指示器上以主色圆点暗示有选中项。 */}
        {hasActiveSecondary ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute"
          />
        ) : null}
      </nav>
    </div>
  );
}

/** 「更多」浮层内的次项条目。点击后关闭浮层。 */
function SidebarMoreItem({
  item,
  active,
  onNavigate,
}: {
  item: NavigationSection['items'][number];
  active: boolean;
  onNavigate: () => void;
}) {
  const t = useTranslations('nav');
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
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
