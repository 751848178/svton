'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { NavigationItem } from '../navigation-items';
import { NavIcon } from '../nav-icons';

interface SidebarItemProps {
  item: NavigationItem;
  active: boolean;
}

/** 单条导航项:Link + 激活态左侧指示条 + NavIcon + i18n label。 */
export function SidebarItem({ item, active }: SidebarItemProps) {
  const t = useTranslations('nav');
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-9 items-center gap-2.5 rounded-md pl-6 pr-3 text-[13px] font-medium transition-colors',
        active
          ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-3 top-2 w-0.5 rounded-sm bg-sidebar-primary"
        />
      )}
      <NavIcon
        name={item.icon}
        className="h-4 w-4 shrink-0"
      />
      <span className="truncate">{t(item.labelKey)}</span>
    </Link>
  );
}
