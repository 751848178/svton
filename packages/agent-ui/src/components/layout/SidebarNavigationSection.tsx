import React from 'react';
import { cn, useI18n } from '@svton/ui';
import { sidebarIcons } from './sidebar-icons';
import type { SidebarItem } from './sidebar.types';

export function SidebarNavigationSection({
  title, showHeader, collapsed, collapsible, items, activeView, onToggleCollapse,
  onNewChat, onItemClick,
}: {
  title: string;
  showHeader: boolean;
  collapsed: boolean;
  collapsible: boolean;
  items: SidebarItem[];
  activeView: string;
  onToggleCollapse: () => void;
  onNewChat?: () => void;
  onItemClick: (item: SidebarItem) => void;
}) {
  const { translate: t } = useI18n();
  return <>
    {showHeader && <div className="px-2 py-2 border-b border-[#333] flex items-center justify-between flex-shrink-0">
      {!collapsed && <span className="text-sm font-medium text-gray-200 truncate px-1">{title}</span>}
      <div className="flex items-center gap-1 ml-auto">{collapsible && (
        <button type="button" onClick={onToggleCollapse}
          className="size-9 text-muted-foreground hover:text-foreground rounded transition-colors max-lg:hidden"
          title={t(collapsed ? 'session.sidebar.expand' : 'session.sidebar.collapse')}>
          {collapsed ? sidebarIcons.expand : sidebarIcons.collapse}
        </button>
      )}</div>
    </div>}
    {onNewChat && <div className="px-1.5 py-1.5 flex-shrink-0">
      <button type="button" onClick={onNewChat}
        className={cn(
          'w-full border border-dashed border-[#333] text-gray-400 hover:text-white hover:border-gray-500 hover:bg-[#2a2a2a]/60 rounded-md flex items-center justify-center gap-1.5 transition-colors',
          collapsed ? 'p-1.5' : 'min-h-9 px-3 py-1.5 text-[13px] font-medium max-lg:min-h-11',
        )} title={t('session.sidebar.new')}>
        {sidebarIcons.newChat}{!collapsed && <span>{t('session.sidebar.new')}</span>}
      </button>
    </div>}
    {items.length > 0 && <div className="px-1 py-0.5 flex-shrink-0">{items.map((item) => {
      const active = item.view === activeView;
      return <button type="button" key={item.id} onClick={() => onItemClick(item)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'w-full flex items-center gap-2 rounded-md transition-colors text-[12px] mb-0.5',
          collapsed ? 'justify-center p-2' : 'min-h-9 px-2.5 py-1.5 max-lg:min-h-11',
          active ? 'bg-[#222] text-gray-200' : 'text-gray-500 hover:bg-[#2a2a2a]/60 hover:text-gray-300',
        )} title={collapsed ? (item.collapsedTooltip || item.label) : undefined}>
        {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
        {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
        {!collapsed && item.badge != null && <span className="text-[9px] bg-cyan-900/40 text-cyan-400 px-1 rounded">{item.badge}</span>}
      </button>;
    })}</div>}
  </>;
}
