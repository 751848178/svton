'use client';

import React, { useMemo, useState } from 'react';
import { NavItem } from './NavItem';
import { PlusIcon, SearchIcon, GearIcon, ChatIcon, AutomationIcon, SkillIcon, TrashIcon, CloseIcon } from './icons';

export type View = 'chat' | 'search' | 'automation' | 'skills' | 'agents' | 'integrations' | 'settings';

interface SidebarProps {
  sessions: Array<{ id: string; title: string }>;
  currentSessionId: string | null;
  onNewChat: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNavigate: (view: View) => void;
  activeView: View;
  onToggle: () => void;
  isMobileOpen: boolean;
}

export function Sidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSwitchSession,
  onDeleteSession,
  onNavigate,
  activeView,
  onToggle,
  isMobileOpen,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const sidebar = (
    <div className="w-60 bg-[#171717] border-r border-[#2a2a2a] flex flex-col shrink-0 select-none h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-3 flex items-center justify-between border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <img src="/agent-icon.svg" alt="" className="w-5 h-5" />
          <span className="text-white text-[15px] font-semibold tracking-tight">Svton</span>
        </div>
        {/* Mobile close button */}
        <button onClick={onToggle} className="text-gray-500 hover:text-gray-300 p-1 md:hidden">
          <CloseIcon />
        </button>
      </div>

      {/* Top navigation */}
      <nav className="px-2 pt-2 space-y-0.5">
        <NavItem icon={<SearchIcon />} label="搜索" active={activeView === 'search'} onClick={() => onNavigate(activeView === 'search' ? 'chat' : 'search')} />
        <NavItem icon={<AutomationIcon />} label="自动化" active={activeView === 'automation'} onClick={() => onNavigate(activeView === 'automation' ? 'chat' : 'automation')} />
        <NavItem icon={<ChatIcon />} label="对话" active={activeView === 'chat'} onClick={() => onNavigate('chat')} />
        <NavItem icon={<SkillIcon />} label="技能" active={activeView === 'skills'} onClick={() => onNavigate(activeView === 'skills' ? 'chat' : 'skills')} />
        <NavItem icon={<ChatIcon />} label="Agents" active={activeView === 'agents'} onClick={() => onNavigate(activeView === 'agents' ? 'chat' : 'agents')} />
        <NavItem icon={<SkillIcon />} label="集成" active={activeView === 'integrations'} onClick={() => onNavigate(activeView === 'integrations' ? 'chat' : 'integrations')} />
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

      {/* New chat */}
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
                onClick={() => { onNavigate('chat'); onSwitchSession(session.id); }}
                className={`w-full text-left px-3 py-1.5 pr-7 rounded-md text-[13px] truncate transition-colors ${
                  session.id === currentSessionId && activeView === 'chat'
                    ? 'bg-[#2a2a2a] text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]/60'
                }`}
              >
                {session.title || '新对话'}
              </button>
              {confirmDeleteId === session.id ? (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
                  <button onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); setConfirmDeleteId(null); }} className="px-1.5 py-0.5 text-[9px] text-white bg-red-600 rounded hover:bg-red-500">确认</button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="px-1.5 py-0.5 text-[9px] text-gray-400 bg-[#333] rounded hover:bg-[#444]">取消</button>
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

      {/* Bottom: 设置 */}
      <div className="border-t border-[#2a2a2a] px-2 py-2">
        <NavItem icon={<GearIcon />} label="设置" active={activeView === 'settings'} onClick={() => onNavigate(activeView === 'settings' ? 'chat' : 'settings')} />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onToggle} />}
      {/* Desktop: always visible. Mobile: toggle overlay */}
      <div className={`${isMobileOpen ? 'fixed inset-y-0 left-0 z-40' : 'hidden md:block'}`}>
        {sidebar}
      </div>
    </>
  );
}
