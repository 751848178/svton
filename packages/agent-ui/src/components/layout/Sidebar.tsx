import React, { useCallback } from 'react';
import { cn, useI18n } from '@svton/ui';
import type { SidebarItem, SidebarProps } from './sidebar.types';
import { sidebarIcons } from './sidebar-icons';
import { SidebarSessionList } from './SidebarSessionList';
import { useSidebarCollapse } from './use-sidebar-collapse';
import { SessionSearchControls } from './SessionSearchControls';
import { useResponsiveSidebarSurface } from './ResponsiveSidebarSurface';
import { SidebarNavigationSection } from './SidebarNavigationSection';
export type { SidebarConfig, SidebarItem, SidebarProps, SidebarSession } from './sidebar.types';
export function Sidebar({
  config,
  activeView,
  onNavigate,
  sessions = [],
  currentSessionId = null,
  onNewChat,
  onSwitchSession,
  managementActions,
  sessionSearch,
  onOpenSettings,
  collapsed: collapsedProp,
  onCollapsedChange,
  onMobileClose,
  className,
  footer,
}: SidebarProps) {
  const { translate: t } = useI18n();
  const {
    items = [],
    showSettings = true,
    showNewChat = true,
    collapsible = true,
    defaultCollapsed = false,
    width = 240,
    collapsedWidth = 48,
    showSessions = true,
    title = 'Svton Agent',
    collapseStorageKey = 'svton-sidebar-collapsed',
  } = config;
  const surface = useResponsiveSidebarSurface();

  const { collapsed: isCollapsed, toggle: handleToggleCollapse } = useSidebarCollapse({
    controlled: collapsedProp,
    defaultCollapsed,
    storageKey: collapseStorageKey,
    onChange: onCollapsedChange,
  });
  // Compact drawers always expose the complete navigation. Keep the persisted
  // wide-screen preference intact so returning to a wide viewport restores it.
  const displayCollapsed = !surface?.compactSurface && isCollapsed;

  const visibleItems = items.filter(item => item.visible !== false);
  const currentWidth = displayCollapsed ? collapsedWidth : width;
  const closeCompact = useCallback(() => {
    onMobileClose?.();
    surface?.closeCompact();
  }, [onMobileClose, surface]);

  const handleItemClick = useCallback((item: SidebarItem) => {
    if (item.action) {
      item.action();
    } else if (item.view) {
      onNavigate(item.view);
    }
    closeCompact();
  }, [onNavigate, closeCompact]);

  return (
      <div
        data-sidebar-content
        className={cn(
          'flex h-full min-h-0 flex-shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-in-out',
          surface?.compactSurface && 'w-full border-r-0',
          className,
        )}
        style={surface?.compactSurface ? undefined : { width: currentWidth }}
      >
        <SidebarNavigationSection
          title={title} showHeader={!surface?.compactSurface}
          collapsed={displayCollapsed} collapsible={collapsible}
          items={visibleItems} activeView={activeView}
          onToggleCollapse={handleToggleCollapse}
          onNewChat={showNewChat ? () => { onNewChat?.(); closeCompact(); } : undefined}
          onItemClick={handleItemClick}
        />

        {showSessions && !displayCollapsed && (
          <div className="flex min-h-0 flex-1 flex-col">
            {sessionSearch && <SessionSearchControls search={sessionSearch} />}
            <SidebarSessionList
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSwitch={(id) => { onSwitchSession?.(id); closeCompact(); }}
              managementActions={managementActions}
            />
          </div>
        )}

        {showSessions && displayCollapsed && (
          <div className="flex-1 overflow-hidden px-1 py-1">
            {sessions.slice(0, 8).map(s => (
              <button
                type="button"
                key={s.id}
                onClick={() => { onSwitchSession?.(s.id); closeCompact(); }}
                aria-current={s.id === currentSessionId ? 'page' : undefined}
                className={cn(
                  'w-full p-2 rounded-md text-[10px] text-center transition-colors mb-0.5',
                  s.id === currentSessionId ? 'bg-[#222] text-gray-200' : 'text-gray-600 hover:bg-[#2a2a2a]/60',
                )}
                title={s.title}
              >
                {s.title.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {footer && !displayCollapsed && (
          <div className="px-2 py-1 flex-shrink-0">{footer}</div>
        )}

        {showSettings && (
          <div className="px-1 py-1.5 border-t border-[#333] flex-shrink-0">
            <button
              type="button"
              onClick={() => { onOpenSettings?.(); closeCompact(); }}
              aria-current={activeView === 'settings' ? 'page' : undefined}
              className={cn(
                'w-full flex items-center gap-2 rounded-md text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a]/60 transition-colors text-[12px]',
                displayCollapsed ? 'justify-center p-2' : 'min-h-9 px-2.5 py-1.5 max-lg:min-h-11',
              )}
              title={displayCollapsed ? t('session.sidebar.settings') : undefined}
            >
              {sidebarIcons.settings}
              {!displayCollapsed && <span>{t('session.sidebar.settings')}</span>}
            </button>
          </div>
        )}
      </div>
  );
}
