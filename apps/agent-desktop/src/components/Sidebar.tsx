import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn } from '@svton/ui';
import type { AgentConfig } from '@svton/agent-core';
import type { SessionInfo, Project } from '@svton/agent-client';
import { PlusIcon, SearchIcon, FolderIcon, GearIcon, TrashIcon, ChatIcon, AutomationIcon, SkillIcon, PluginIcon, AgentIcon, WorktreeIcon, ChronicleIcon, IntegrationIcon } from './icons';
import { startDragging, toggleMaximize } from '@/lib/window-controls';

export type View = 'chat' | 'search' | 'automation' | 'skills' | 'plugins' | 'agents' | 'worktrees' | 'chronicle' | 'integrations' | 'settings';

interface SidebarProps {
  config: AgentConfig | null;
  sessions: SessionInfo[];
  currentSessionId: string | null;
  projects: Project[];
  currentProjectId: string | null;
  onNewChat: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNavigate: (view: View) => void;
  onSwitchProject: (id: string | null) => void;
  onOpenProjectFolder: () => void;
  onDeleteProject: (id: string) => void;
  activeView: View;
  className?: string;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} 周前`;
  const months = Math.floor(days / 30);
  return `${months} 个月前`;
}

// ── NavItem helper ────────────────────────────────────────

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-1.5 text-[13px] rounded-md flex items-center gap-2.5 transition-colors',
        active
          ? 'text-white bg-[#2a2a2a]'
          : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]/60',
      )}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** Secondary navigation — skills/plugins/agents/worktrees/integrations/chronicle
 *  collapsed under a "更多" toggle to keep the sidebar clean. */
function SecondaryNav({ activeView, onNavigate }: { activeView: View; onNavigate: (v: View) => void }) {
  const [open, setOpen] = useState(false);
  const items: { icon: React.ReactNode; label: string; view: View }[] = [
    { icon: <SkillIcon />, label: '技能', view: 'skills' },
    { icon: <PluginIcon />, label: '插件', view: 'plugins' },
    { icon: <AgentIcon />, label: 'Agents', view: 'agents' },
    { icon: <WorktreeIcon />, label: '工作树', view: 'worktrees' },
    { icon: <IntegrationIcon />, label: '集成', view: 'integrations' },
    { icon: <ChronicleIcon />, label: '屏幕记忆', view: 'chronicle' },
  ];
  // Auto-expand if a secondary view is active
  const hasActiveSecondary = items.some((i) => i.view === activeView);
  const isExpanded = open || hasActiveSecondary;

  return (
    <div className="px-2">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full text-left px-3 py-1.5 text-[13px] rounded-md flex items-center gap-2.5 transition-colors',
          hasActiveSecondary
            ? 'text-white bg-[#2a2a2a]'
            : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]/60',
        )}
      >
        <span className="flex-shrink-0 opacity-70">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
        </span>
        <span>更多</span>
        <span className="ml-auto text-[10px] text-gray-600">{isExpanded ? '▾' : '▸'}</span>
      </button>
      {isExpanded && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <NavItem
              key={item.view}
              icon={item.icon}
              label={item.label}
              active={activeView === item.view}
              onClick={() => onNavigate(activeView === item.view ? 'chat' : item.view)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Sidebar Component ────────────────────────────────

export function Sidebar({
  config,
  sessions,
  currentSessionId,
  projects,
  currentProjectId,
  onNewChat,
  onSwitchSession,
  onDeleteSession,
  onNavigate,
  onSwitchProject,
  onOpenProjectFolder,
  onDeleteProject,
  activeView,
  className,
}: SidebarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const safeSessions = Array.isArray(sessions) ? sessions : [];

  // Show sessions with messages, plus the currently active session (even if empty)
  const visibleSessions = useMemo(
    () => safeSessions.filter((s) => s.messageCount > 0 || s.id === currentSessionId),
    [safeSessions, currentSessionId],
  );

  // Group sessions by project
  const groupedSessions = useMemo(() => {
    const groups = new Map<string, SessionInfo[]>();

    // Create groups for each project
    for (const p of projects) {
      groups.set(p.id, []);
    }
    // Group for non-project sessions
    groups.set('__chat__', []);

    for (const s of visibleSessions) {
      const key = s.projectId || '__chat__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    return groups;
  }, [visibleSessions, projects]);

  // All sessions for search modal
  const allSessions = useMemo(() => {
    return visibleSessions.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  }, [visibleSessions]);

  const filteredGroups = groupedSessions;

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Close project menu on outside click
  useEffect(() => {
    if (!projectMenuId) return;
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setProjectMenuId(null);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [projectMenuId]);

  // Close "more" menu on outside click
  useEffect(() => {
    if (!moreMenuOpen) return;
    const fn = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [moreMenuOpen]);

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleSearchSelect = useCallback((id: string) => {
    onSwitchSession(id);
    onNavigate('chat');
    setSearchOpen(false);
  }, [onSwitchSession, onNavigate]);

  // Find current project for header display
  const currentProject = projects.find((p) => p.id === currentProjectId);

  return (
    <div
      className={cn(
        'w-60 bg-[#171717]/95 border-r border-white/[0.06] flex flex-col shrink-0 select-none',
        className,
      )}
    >
      {/* Header — also serves as drag region */}
      <div
        onMouseDown={() => startDragging()}
        onDoubleClick={() => toggleMaximize()}
        className="px-4 pt-9 pb-3 flex items-center justify-between border-b border-white/[0.06] cursor-default"
      >
        <div className="flex items-center gap-2">
          <img src="/agent-icon.svg" alt="" className="w-5 h-5" />
          <span className="text-white text-[15px] font-semibold tracking-tight">Svton</span>
        </div>
      </div>

      {/* Primary navigation — 新对话 / 搜索 / 自动化 */}
      <nav className="px-2 pt-2 space-y-0.5">
        <div className="px-1 pb-1">
          <button
            onClick={onNewChat}
            className="w-full px-3 py-1.5 text-[13px] font-medium rounded-md border border-dashed border-[#333] text-gray-400 hover:text-white hover:border-gray-500 hover:bg-[#2a2a2a]/60 transition-colors flex items-center justify-center gap-1.5"
          >
            <PlusIcon />
            新对话
          </button>
        </div>
        <NavItem icon={<SearchIcon />} label="搜索" onClick={() => setSearchOpen(true)} />
        <NavItem icon={<AutomationIcon />} label="自动化" active={activeView === 'automation'} onClick={() => onNavigate(activeView === 'automation' ? 'chat' : 'automation')} />
      </nav>

      {/* Session list header with "更多" popup menu */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="flex items-center justify-between px-2 pt-2 pb-1">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">会话</span>
          <div ref={moreMenuRef} className="relative">
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={cn(
                'text-gray-600 hover:text-gray-300 p-0.5 rounded hover:bg-[#2a2a2a]/60 transition-colors',
                moreMenuOpen && 'text-gray-300',
              )}
              title="更多"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-50 py-1">
                {([
                  { icon: <SkillIcon />, label: '技能', view: 'skills' as View },
                  { icon: <PluginIcon />, label: '插件', view: 'plugins' as View },
                  { icon: <AgentIcon />, label: 'Agents', view: 'agents' as View },
                  { icon: <WorktreeIcon />, label: '工作树', view: 'worktrees' as View },
                  { icon: <IntegrationIcon />, label: '集成', view: 'integrations' as View },
                  { icon: <ChronicleIcon />, label: '屏幕记忆', view: 'chronicle' as View },
                ]).map((item) => (
                  <button
                    key={item.view}
                    onClick={() => { setMoreMenuOpen(false); onNavigate(item.view); }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 transition-colors',
                      activeView === item.view ? 'text-white bg-[#252525]' : 'text-gray-400 hover:bg-[#252525] hover:text-gray-200',
                    )}
                  >
                    <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Projects section header with "..." menu */}
        {projects.length > 0 && (
          <div className="flex items-center justify-between px-2 pt-2 pb-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">项目</span>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setProjectMenuId(projectMenuId === '__header__' ? null : '__header__')}
                className="text-gray-600 hover:text-gray-300 p-0.5 rounded hover:bg-[#2a2a2a]/60 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
              </button>
              {projectMenuId === '__header__' && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-50 py-1">
                  <button
                    onClick={() => { setProjectMenuId(null); onOpenProjectFolder(); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:bg-[#252525] hover:text-gray-200 flex items-center gap-2 transition-colors"
                  >
                    <FolderIcon />
                    <span>新建项目</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Project groups — always show all projects */}
        {projects.map((project) => {
          const groupSessions = filteredGroups.get(project.id) ?? [];
          const isCollapsed = collapsedGroups.has(project.id);
          const isActive = project.id === currentProjectId;

          return (
            <div key={project.id} className="mb-1">
              {/* Project header */}
              <div
                className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#2a2a2a]/40 transition-colors"
                onClick={() => { onSwitchProject(project.id); onNavigate('chat'); }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleGroup(project.id); }}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn('transition-transform', isCollapsed ? '' : 'rotate-90')}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <FolderIcon />
                <span className="flex-1 text-[12px] truncate text-gray-300">{project.name}</span>
                <span className="text-[9px] text-gray-600">{formatRelativeTime(project.updatedAt)}</span>
                {/* Delete project */}
                {confirmDeleteProjectId === project.id ? (
                  <div className="flex items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setConfirmDeleteProjectId(null); }} className="px-1 py-0.5 text-[8px] text-white bg-red-600 rounded">确认</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteProjectId(null); }} className="px-1 py-0.5 text-[8px] text-gray-400 bg-[#333] rounded">取消</button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteProjectId(project.id); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-opacity"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>

              {/* Sessions under this project */}
              {!isCollapsed && groupSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId && activeView === 'chat'}
                  confirmDeleteId={confirmDeleteId}
                  onSwitch={() => { onNavigate('chat'); onSwitchSession(session.id); }}
                  onDelete={() => onDeleteSession(session.id)}
                  onConfirmDelete={setConfirmDeleteId}
                />
              ))}
            </div>
          );
        })}

        {/* Chat mode group (sessions without project) */}
        {(() => {
          const chatSessions = filteredGroups.get('__chat__');
          const hasChatSessions = chatSessions && chatSessions.length > 0;
          if (!hasChatSessions && projects.length > 0) return null;
          const isCollapsed = collapsedGroups.has('__chat__');
          return (
            <div className="mb-1">
              <div
                className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-[#2a2a2a]/40 transition-colors"
                onClick={() => { onSwitchProject(null); onNavigate('chat'); }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleGroup('__chat__'); }}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn('transition-transform', isCollapsed ? '' : 'rotate-90')}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <ChatIcon />
                <span className={cn('flex-1 text-[12px]', !currentProjectId ? 'text-white' : 'text-gray-300')}>Chat 模式</span>
              </div>
              {!isCollapsed && hasChatSessions && chatSessions!.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId && activeView === 'chat'}
                  confirmDeleteId={confirmDeleteId}
                  onSwitch={() => { onNavigate('chat'); onSwitchSession(session.id); }}
                  onDelete={() => onDeleteSession(session.id)}
                  onConfirmDelete={setConfirmDeleteId}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Settings */}
      <div className="border-t border-[#2a2a2a] px-2 py-2">
        <NavItem
          icon={<GearIcon />}
          label="设置"
          active={activeView === 'settings'}
          onClick={() => onNavigate(activeView === 'settings' ? 'chat' : 'settings')}
        />
      </div>

      {/* Search Modal */}
      {searchOpen && (
        <SearchModal
          sessions={allSessions}
          onSelect={handleSearchSelect}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}

// ── Session item ────────────────────────────────────────

function SessionItem({
  session,
  isActive,
  confirmDeleteId,
  onSwitch,
  onDelete,
  onConfirmDelete,
}: {
  session: SessionInfo;
  isActive: boolean;
  confirmDeleteId: string | null;
  onSwitch: () => void;
  onDelete: () => void;
  onConfirmDelete: (id: string | null) => void;
}) {
  return (
    <div className="relative group mb-0.5 ml-3">
      <button
        onClick={onSwitch}
        className={cn(
          'w-full text-left px-3 py-1.5 pr-7 rounded-md text-[12px] truncate transition-colors',
          isActive
            ? 'bg-[#2a2a2a] text-white'
            : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]/60',
        )}
      >
        {session.title || '新对话'}
      </button>
      {confirmDeleteId === session.id ? (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
          <button onClick={(e) => { e.stopPropagation(); onDelete(); onConfirmDelete(null); }} className="px-1.5 py-0.5 text-[9px] text-white bg-red-600 rounded hover:bg-red-500">确认</button>
          <button onClick={(e) => { e.stopPropagation(); onConfirmDelete(null); }} className="px-1.5 py-0.5 text-[9px] text-gray-400 bg-[#333] rounded hover:bg-[#444]">取消</button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onConfirmDelete(session.id); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

// ── Search Modal (Command Palette) ────────────────────────

function SearchModal({ sessions, onSelect, onClose }: {
  sessions: SessionInfo[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter sessions
  const filtered = useMemo(() => {
    if (!query.trim()) return sessions;
    const q = query.toLowerCase();
    return sessions.filter(s => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const session = filtered[selectedIndex];
      if (session) onSelect(session.id);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-[480px] max-w-[90vw] bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a2a]">
          <span className="text-gray-500"><SearchIcon /></span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索对话..."
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 outline-none"
          />
          <kbd className="text-[10px] text-gray-600 border border-[#333] rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-gray-600">
              {query.trim() ? '没有找到匹配的对话' : '暂无对话'}
            </div>
          ) : (
            <>
              {!query.trim() && (
                <div className="px-4 pt-2 pb-1 text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                  近期对话
                </div>
              )}
              {filtered.map((session, i) => (
                <button
                  key={session.id}
                  onClick={() => onSelect(session.id)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 transition-colors',
                    i === selectedIndex ? 'bg-[#2a2a2a]' : 'hover:bg-[#222]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-gray-200 truncate flex-1">
                      {session.title || '新对话'}
                    </span>
                    <span className="text-[10px] text-gray-600 flex-shrink-0">
                      {formatRelativeTime(session.updatedAt)}
                    </span>
                  </div>
                  {session.messageCount > 0 && (
                    <div className="text-[11px] text-gray-600 mt-0.5">
                      {session.messageCount} 条消息
                    </div>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#2a2a2a] text-[10px] text-gray-600">
          <div className="flex items-center gap-3">
            <span><kbd className="text-gray-500">↑↓</kbd> 导航</span>
            <span><kbd className="text-gray-500">↵</kbd> 选择</span>
          </div>
          <span>{filtered.length} 个对话</span>
        </div>
      </div>
    </div>
  );
}
