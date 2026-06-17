/**
 * Shared Sidebar component — configurable, collapsible.
 *
 * Used by agent-app, agent-desktop, and agent-web.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@svton/ui';

// ============================================================
// Types
// ============================================================

export interface SidebarItem {
  /** Unique ID */
  id: string;
  /** Display label */
  label: string;
  /** Icon element */
  icon?: React.ReactNode;
  /** Switch to this view on click (for panel switching) */
  view?: string;
  /** Custom action on click (for modals, downloads, etc.) — overrides view */
  action?: () => void;
  /** Badge count or text */
  badge?: number | string;
  /** Whether to show this item (default: true) */
  visible?: boolean;
  /** Tooltip when collapsed (defaults to label) */
  collapsedTooltip?: string;
}

export interface SidebarConfig {
  /** Navigation items */
  items: SidebarItem[];
  /** Show settings entry at bottom (default: true) */
  showSettings?: boolean;
  /** Show new chat button (default: true) */
  showNewChat?: boolean;
  /** Allow collapse/expand (default: true) */
  collapsible?: boolean;
  /** Start collapsed (default: false) */
  defaultCollapsed?: boolean;
  /** Expanded width in px (default: 240) */
  width?: number;
  /** Collapsed width in px (default: 48) */
  collapsedWidth?: number;
  /** Show session list (default: true) */
  showSessions?: boolean;
  /** App title in header */
  title?: string;
}

export interface SidebarProps {
  config: SidebarConfig;
  /** Currently active view */
  activeView: string;
  onNavigate: (view: string) => void;
  // Sessions
  sessions?: Array<{ id: string; title: string }>;
  currentSessionId?: string | null;
  onNewChat?: () => void;
  onSwitchSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  // Settings
  onOpenSettings?: () => void;
  // Collapse state (controlled)
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  // Mobile
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  className?: string;
  /** Extra content rendered at bottom (above settings) */
  footer?: React.ReactNode;
}

// ============================================================
// Default icons
// ============================================================

const defaultIcons = {
  settings: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  newChat: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  collapse: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  expand: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  close: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
};

// ============================================================
// Component
// ============================================================

export function Sidebar({
  config,
  activeView,
  onNavigate,
  sessions = [],
  currentSessionId = null,
  onNewChat,
  onSwitchSession,
  onDeleteSession,
  onOpenSettings,
  collapsed: collapsedProp,
  onCollapsedChange,
  isMobileOpen = false,
  onMobileClose,
  className,
  footer,
}: SidebarProps) {
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
  } = config;

  // Uncontrolled collapse state
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    try { return localStorage.getItem('svton-sidebar-collapsed') === 'true'; } catch { return defaultCollapsed; }
  });
  const isCollapsed = collapsedProp ?? internalCollapsed;

  const handleToggleCollapse = useCallback(() => {
    const next = !isCollapsed;
    if (onCollapsedChange) {
      onCollapsedChange(next);
    } else {
      setInternalCollapsed(next);
      try { localStorage.setItem('svton-sidebar-collapsed', String(next)); } catch {}
    }
  }, [isCollapsed, onCollapsedChange]);

  const visibleItems = items.filter(item => item.visible !== false);
  const currentWidth = isCollapsed ? collapsedWidth : width;

  // Handle item click
  const handleItemClick = useCallback((item: SidebarItem) => {
    if (item.action) {
      item.action();
    } else if (item.view) {
      onNavigate(item.view);
    }
    // Close mobile sidebar on navigation
    onMobileClose?.();
  }, [onNavigate, onMobileClose]);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onMobileClose} />
      )}

      <div
        className={cn(
          'flex-shrink-0 bg-[#171717] border-r border-[#222] flex flex-col transition-[width] duration-200 ease-in-out',
          // Mobile: fixed overlay
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40',
          isMobileOpen ? 'max-md:flex' : 'max-md:hidden',
          'md:flex',
          className,
        )}
        style={{ width: currentWidth }}
      >
        {/* Header */}
        <div className="px-2 py-2 border-b border-[#222] flex items-center justify-between flex-shrink-0">
          {!isCollapsed && (
            <span className="text-sm font-medium text-gray-200 truncate px-1">{title}</span>
          )}

          <div className="flex items-center gap-1 ml-auto">
            {/* Collapse toggle */}
            {collapsible && (
              <button
                onClick={handleToggleCollapse}
                className="p-1 text-gray-600 hover:text-gray-300 rounded transition-colors"
                title={isCollapsed ? '展开' : '收起'}
              >
                {isCollapsed ? defaultIcons.expand : defaultIcons.collapse}
              </button>
            )}
            {/* Mobile close */}
            <button
              onClick={onMobileClose}
              className="p-1 text-gray-600 hover:text-gray-300 rounded transition-colors md:hidden"
            >
              {defaultIcons.close}
            </button>
          </div>
        </div>

        {/* New chat */}
        {showNewChat && (
          <div className="px-1.5 py-1.5 flex-shrink-0">
            <button
              onClick={() => { onNewChat?.(); onMobileClose?.(); }}
              className={cn(
                'w-full border border-dashed border-[#333] text-gray-400 hover:text-white hover:border-gray-500 hover:bg-[#1c1c1c]/60 rounded-md flex items-center justify-center gap-1.5 transition-colors',
                isCollapsed ? 'p-1.5' : 'px-3 py-1.5 text-[13px] font-medium',
              )}
              title="新对话"
            >
              {defaultIcons.newChat}
              {!isCollapsed && <span>新对话</span>}
            </button>
          </div>
        )}

        {/* Nav items */}
        {visibleItems.length > 0 && (
          <div className="px-1 py-0.5 flex-shrink-0">
            {visibleItems.map(item => {
              const isActive = item.view === activeView;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-md transition-colors text-[12px] mb-0.5',
                    isCollapsed ? 'justify-center p-2' : 'px-2.5 py-1.5',
                    isActive
                      ? 'bg-[#222] text-gray-200'
                      : 'text-gray-500 hover:bg-[#1c1c1c]/60 hover:text-gray-300',
                  )}
                  title={isCollapsed ? (item.collapsedTooltip || item.label) : undefined}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  {!isCollapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {!isCollapsed && item.badge != null && (
                    <span className="text-[9px] bg-cyan-900/40 text-cyan-400 px-1 rounded">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Session list */}
        {showSessions && !isCollapsed && (
          <SessionList
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSwitch={(id) => { onSwitchSession?.(id); onMobileClose?.(); }}
            onDelete={onDeleteSession}
          />
        )}

        {/* Collapsed session icons */}
        {showSessions && isCollapsed && (
          <div className="flex-1 overflow-hidden px-1 py-1">
            {sessions.slice(0, 8).map(s => (
              <button
                key={s.id}
                onClick={() => { onSwitchSession?.(s.id); onMobileClose?.(); }}
                className={cn(
                  'w-full p-2 rounded-md text-[10px] text-center transition-colors mb-0.5',
                  s.id === currentSessionId ? 'bg-[#222] text-gray-200' : 'text-gray-600 hover:bg-[#1c1c1c]/60',
                )}
                title={s.title}
              >
                {s.title.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        {footer && !isCollapsed && (
          <div className="px-2 py-1 flex-shrink-0">{footer}</div>
        )}

        {/* Settings */}
        {showSettings && (
          <div className="px-1 py-1.5 border-t border-[#222] flex-shrink-0">
            <button
              onClick={() => { onOpenSettings?.(); onMobileClose?.(); }}
              className={cn(
                'w-full flex items-center gap-2 rounded-md text-gray-500 hover:text-gray-300 hover:bg-[#1c1c1c]/60 transition-colors text-[12px]',
                isCollapsed ? 'justify-center p-2' : 'px-2.5 py-1.5',
              )}
              title={isCollapsed ? '设置' : undefined}
            >
              {defaultIcons.settings}
              {!isCollapsed && <span>设置</span>}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// SessionList sub-component
// ============================================================

function SessionList({
  sessions,
  currentSessionId,
  onSwitch,
  onDelete,
}: {
  sessions: Array<{ id: string; title: string }>;
  currentSessionId: string | null;
  onSwitch: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto px-1 min-h-0">
      {sessions.length === 0 ? (
        <div className="text-center text-gray-600 text-xs py-4">暂无对话</div>
      ) : (
        sessions.map(s => (
          <div
            key={s.id}
            onClick={() => onSwitch(s.id)}
            className={cn(
              'group flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-[12px] mb-0.5 transition-colors',
              s.id === currentSessionId
                ? 'bg-[#222] text-gray-200'
                : 'text-gray-500 hover:bg-[#1c1c1c]/60 hover:text-gray-300',
            )}
          >
            <span className="flex-1 truncate">{s.title}</span>
            {confirmDelete === s.id ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { onDelete?.(s.id); setConfirmDelete(null); }} className="text-[9px] text-red-500">删除</button>
                <button onClick={() => setConfirmDelete(null)} className="text-[9px] text-gray-500">取消</button>
              </div>
            ) : (
              onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-opacity text-[10px]"
                >
                  ×
                </button>
              )
            )}
          </div>
        ))
      )}
    </div>
  );
}
