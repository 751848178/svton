import React, { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@svton/ui';
import type { AgentConfig } from '@svton/agent-core';
import type { SessionInfo, Project } from '@svton/agent-client';
import { PlusIcon, SearchIcon, FolderIcon, GearIcon, TrashIcon, ChatIcon, AutomationIcon, SkillIcon } from './icons';

// Tauri v2 window drag helper (shared with MainLayout)
let startDraggingFn: (() => Promise<void>) | null = null;
async function startDrag() {
  if (startDraggingFn) { startDraggingFn(); return; }
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window' as string);
    const appWindow = getCurrentWindow();
    startDraggingFn = () => appWindow.startDragging();
    startDraggingFn();
  } catch { /* non-Tauri environment */ }
}
const handleDragStart = () => { startDrag(); };

export type View = 'chat' | 'search' | 'automation' | 'skills' | 'settings';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedSessions;
    const q = searchQuery.toLowerCase();
    const result = new Map<string, SessionInfo[]>();
    for (const [key, sessions] of groupedSessions) {
      const filtered = sessions.filter((s) => s.title.toLowerCase().includes(q));
      if (filtered.length > 0) result.set(key, filtered);
    }
    return result;
  }, [groupedSessions, searchQuery]);

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
      <div onMouseDown={handleDragStart} className="px-4 pt-9 pb-3 flex items-center justify-between border-b border-white/[0.06] cursor-default">
        <div className="flex items-center gap-2">
          <span className="text-white text-[15px] font-semibold tracking-tight">Svton</span>
          <span className="text-gray-600 text-sm">{'\u2192'}</span>
        </div>
      </div>

      {/* Top navigation */}
      <nav className="px-2 pt-2 space-y-0.5">
        <NavItem icon={<SearchIcon />} label="搜索" active={activeView === 'search'} onClick={() => onNavigate(activeView === 'search' ? 'chat' : 'search')} />
        <NavItem icon={<AutomationIcon />} label="自动化" active={activeView === 'automation'} onClick={() => onNavigate(activeView === 'automation' ? 'chat' : 'automation')} />
        <NavItem icon={<ChatIcon />} label="对话" active={activeView === 'chat'} onClick={() => onNavigate('chat')} />
        <NavItem icon={<SkillIcon />} label="技能" active={activeView === 'skills'} onClick={() => onNavigate(activeView === 'skills' ? 'chat' : 'skills')} />
      </nav>

      {/* Search bar */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#222] border border-[#2a2a2a]">
          <span className="text-gray-500"><SearchIcon /></span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索会话..."
            className="flex-1 bg-transparent text-[12px] text-gray-300 placeholder:text-gray-600 outline-none"
          />
        </div>
      </div>

      {/* New chat button */}
      <div className="px-3 pb-1">
        <button
          onClick={onNewChat}
          className="w-full px-3 py-1.5 text-[13px] font-medium rounded-md border border-dashed border-[#333] text-gray-400 hover:text-white hover:border-gray-500 hover:bg-[#2a2a2a]/60 transition-colors flex items-center justify-center gap-1.5"
        >
          <PlusIcon />
          新对话
        </button>
      </div>

      {/* Session list grouped by project */}
      <div className="flex-1 overflow-y-auto px-2">
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
