import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@svton/ui';
import {
  AgentIcon,
  AutomationIcon,
  ChronicleIcon,
  GearIcon,
  IntegrationIcon,
  PluginIcon,
  PlusIcon,
  SearchIcon,
  SkillIcon,
  WorktreeIcon,
  ToolboxIcon,
} from './icons';
import { startDragging, toggleMaximize } from '@/lib/window-controls';
import type { View } from './desktop-sidebar.types';

const TOOLS = [
  { icon: <SkillIcon />, label: '技能', view: 'skills' as View },
  { icon: <PluginIcon />, label: '插件', view: 'plugins' as View },
  { icon: <AgentIcon />, label: 'Agents', view: 'agents' as View },
  { icon: <WorktreeIcon />, label: '工作树', view: 'worktrees' as View },
  { icon: <IntegrationIcon />, label: '集成', view: 'integrations' as View },
  { icon: <ChronicleIcon />, label: '屏幕记忆', view: 'chronicle' as View },
];

export function DesktopSidebarNavigation({
  activeView,
  onNewChat,
  onSearch,
  onNavigate,
}: {
  activeView: View;
  onNewChat: () => void;
  onSearch: () => void;
  onNavigate: (view: View) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moreOpen]);
  return (
    <>
      <div
        onMouseDown={() => startDragging()}
        onDoubleClick={() => toggleMaximize()}
        className="flex cursor-default items-center justify-between border-b border-[#333] px-4 pb-3 pt-9"
      >
        <div className="flex items-center gap-2">
          <img src="/agent-icon.svg" alt="" className="h-5 w-5" />
          <span className="text-[15px] font-semibold tracking-tight text-white">Svton</span>
        </div>
      </div>
      <nav className="space-y-0.5 px-2 pt-2">
        <NavigationItem icon={<PlusIcon />} label="新对话" onClick={onNewChat} />
        <NavigationItem icon={<SearchIcon />} label="搜索" onClick={onSearch} />
        <NavigationItem
          icon={<AutomationIcon />}
          label="自动化"
          active={activeView === 'automation'}
          onClick={() => onNavigate(activeView === 'automation' ? 'chat' : 'automation')}
        />
        <div ref={menuRef} className="relative">
          <NavigationItem
            icon={<ToolboxIcon />}
            label="工具箱"
            active={TOOLS.some((item) => item.view === activeView)}
            expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          />
          {moreOpen && (
            <div role="menu" aria-label="工具箱" className="absolute left-0 top-full z-50 mt-0.5 w-full rounded-lg border border-[#383838] bg-[#2a2a2a] py-1 shadow-xl">
              {TOOLS.map((item) => (
                <button
                  type="button"
                  role="menuitem"
                  key={item.view}
                  onClick={() => { setMoreOpen(false); onNavigate(item.view); }}
                  aria-current={activeView === item.view ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-2 px-3 text-left text-[12px] transition-colors',
                    activeView === item.view
                      ? 'bg-[#252525] text-white'
                      : 'text-gray-400 hover:bg-[#252525] hover:text-gray-200',
                  )}
                >
                  <span className="shrink-0 opacity-70">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}

export function DesktopSidebarSettings({ active, onClick }: {
  active: boolean; onClick: () => void;
}) {
  return (
    <div className="border-t border-[#383838] px-2 py-2">
      <NavigationItem icon={<GearIcon />} label="设置" active={active} onClick={onClick} />
    </div>
  );
}

function NavigationItem({ icon, label, active, expanded, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; expanded?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} aria-expanded={expanded} aria-haspopup={expanded == null ? undefined : 'menu'} className={cn(
      'flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-[13px] transition-colors',
      active ? 'bg-[#2a2a2a] text-white' : 'text-gray-400 hover:bg-[#2a2a2a]/60 hover:text-gray-200',
    )}>
      <span className="shrink-0 opacity-70">{icon}</span><span>{label}</span>
    </button>
  );
}
