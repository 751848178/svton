import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@svton/ui';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import type { SessionInfo } from '@svton/agent-client';
import { PlusIcon, SearchIcon, FolderIcon, GearIcon, TrashIcon, ChatIcon, AutomationIcon, SkillIcon } from './icons';
import { useGitBranch } from '@/hooks/useGitBranch';

export type View = 'chat' | 'search' | 'automation' | 'skills' | 'settings';

interface SidebarProps {
  config: AgentConfig | null;
  platform: TauriPlatform;
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNavigate: (view: View) => void;
  activeView: View;
  className?: string;
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
  platform,
  sessions,
  currentSessionId,
  onNewChat,
  onSwitchSession,
  onDeleteSession,
  onNavigate,
  activeView,
  className,
}: SidebarProps) {
  const [projectName, setProjectName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const workingDir = config?.workingDir || '/';
  const gitBranch = useGitBranch(platform, workingDir);

  // Extract project name
  useEffect(() => {
    const parts = workingDir.replace(/\\/g, '/').split('/').filter(Boolean);
    setProjectName(parts.length > 0 ? parts[parts.length - 1] : '/');
  }, [workingDir]);

  // Filter sessions by search
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return safeSessions;
    const q = searchQuery.toLowerCase();
    return safeSessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [safeSessions, searchQuery]);

  return (
    <div
      className={cn(
        'w-60 bg-[#171717] border-r border-[#2a2a2a] flex flex-col shrink-0 select-none',
        className,
      )}
    >
      {/* Header — pt-9 for macOS traffic lights */}
      <div className="px-4 pt-9 pb-3 flex items-center justify-between border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <span className="text-white text-[15px] font-semibold tracking-tight">Svton</span>
          <span className="text-gray-600 text-sm">{'\u2192'}</span>
        </div>
      </div>

      {/* Top navigation */}
      <nav className="px-2 pt-2 space-y-0.5">
        <NavItem
          icon={<SearchIcon />}
          label="搜索"
          active={activeView === 'search'}
          onClick={() => onNavigate(activeView === 'search' ? 'chat' : 'search')}
        />
        <NavItem
          icon={<AutomationIcon />}
          label="自动化"
          active={activeView === 'automation'}
          onClick={() => onNavigate(activeView === 'automation' ? 'chat' : 'automation')}
        />
        <NavItem
          icon={<ChatIcon />}
          label="对话"
          active={activeView === 'chat'}
          onClick={() => onNavigate('chat')}
        />
        <NavItem
          icon={<SkillIcon />}
          label="技能"
          active={activeView === 'skills'}
          onClick={() => onNavigate(activeView === 'skills' ? 'chat' : 'skills')}
        />
      </nav>

      {/* Search bar (visible when search is active or always for filtering sessions) */}
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

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2">
        {filteredSessions.length === 0 ? (
          <div className="px-3 py-4 text-center text-[11px] text-gray-600">
            {sessions.length === 0 ? '暂无会话' : '无匹配结果'}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div key={session.id} className="relative group mb-0.5">
              <button
                onClick={() => {
                  onNavigate('chat');
                  onSwitchSession(session.id);
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 pr-7 rounded-md text-[13px] truncate transition-colors',
                  session.id === currentSessionId && activeView === 'chat'
                    ? 'bg-[#2a2a2a] text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]/60',
                )}
              >
                {session.title || '新对话'}
              </button>
              {/* Delete button */}
              {confirmDeleteId === session.id ? (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); setConfirmDeleteId(null); }}
                    className="px-1.5 py-0.5 text-[9px] text-white bg-red-600 rounded hover:bg-red-500"
                  >
                    确认
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                    className="px-1.5 py-0.5 text-[9px] text-gray-400 bg-[#333] rounded hover:bg-[#444]"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(session.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Project section (desktop-only) */}
      {config && (
        <div className="border-t border-[#2a2a2a] px-3 py-2">
          <div className="text-[10px] text-gray-600 uppercase tracking-[0.1em] mb-1">项目</div>
          <div className="flex items-center gap-2 px-1 text-[12px] text-gray-400">
            <FolderIcon />
            <span className="truncate">{projectName}</span>
          </div>
          {gitBranch && (
            <div className="flex items-center gap-1.5 px-1 mt-1 text-[11px] text-gray-600">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
              <span>{gitBranch}</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom: 设置 */}
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
