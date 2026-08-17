import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@svton/ui';
import type {
  Project,
  SessionActivityViewModel,
  SessionInfo,
  SessionManagementController,
  SessionManagementViewModel,
} from '@svton/agent-client';
import { ChatIcon, ChevronIcon, FolderIcon, MoreIcon, TrashIcon } from './icons';
import { DesktopSessionRow } from './DesktopSessionRow';
import { formatRelativeTime } from './desktop-sidebar-time';
import type { View } from './desktop-sidebar.types';

export function DesktopSessionGroups({
  projects,
  groupedSessions,
  activityBySessionId,
  managementBySessionId,
  managementActions,
  currentSessionId,
  currentProjectId,
  activeView,
  onSwitchSession,
  onNavigate,
  onSwitchProject,
  onOpenProjectFolder,
  onDeleteProject,
}: {
  projects: Project[];
  groupedSessions: ReadonlyMap<string, SessionInfo[]>;
  activityBySessionId: ReadonlyMap<string, SessionActivityViewModel>;
  managementBySessionId: ReadonlyMap<string, SessionManagementViewModel>;
  managementActions: SessionManagementController;
  currentSessionId: string | null;
  currentProjectId: string | null;
  activeView: View;
  onSwitchSession: (id: string) => void;
  onNavigate: (view: View) => void;
  onSwitchProject: (id: string | null) => void;
  onOpenProjectFolder: () => void;
  onDeleteProject: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmProject, setConfirmProject] = useState<string | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!projectMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!projectMenuRef.current?.contains(event.target as Node)) setProjectMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [projectMenuOpen]);
  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectSession = (id: string) => {
    onNavigate('chat');
    onSwitchSession(id);
  };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2">
      {projects.length > 0 && (
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">项目</span>
          <div ref={projectMenuRef} className="relative">
            <button
              type="button"
              aria-label="项目操作"
              onClick={() => setProjectMenuOpen((open) => !open)}
              className="rounded p-0.5 text-gray-600 hover:bg-[#2a2a2a]/60 hover:text-gray-300"
            >
              <MoreIcon />
            </button>
            {projectMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-[#383838] bg-[#2a2a2a] py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => { setProjectMenuOpen(false); onOpenProjectFolder(); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-gray-400 hover:bg-[#252525] hover:text-gray-200"
                >
                  <FolderIcon />新建项目
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {projects.map((project) => (
        <div key={project.id} className="mb-1">
          <ProjectRow
            project={project}
            active={project.id === currentProjectId}
            collapsed={collapsed.has(project.id)}
            confirming={confirmProject === project.id}
            onToggle={() => toggle(project.id)}
            onSelect={() => { onSwitchProject(project.id); onNavigate('chat'); }}
            onConfirm={(value) => setConfirmProject(value ? project.id : null)}
            onDelete={() => { onDeleteProject(project.id); setConfirmProject(null); }}
          />
          {!collapsed.has(project.id) && (groupedSessions.get(project.id) ?? []).map((session) => (
            <DesktopSessionRow
              key={session.id}
              session={session}
              activity={activityBySessionId.get(session.id)}
              management={managementBySessionId.get(session.id)}
              managementActions={managementActions}
              active={session.id === currentSessionId && activeView === 'chat'}
              onSwitch={() => selectSession(session.id)}
            />
          ))}
        </div>
      ))}
      <div className="mb-1">
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-[#2a2a2a]/40">
          <button type="button" aria-label="切换 Chat 分组" onClick={() => toggle('__chat__')} className={cn('text-gray-500 transition-transform', !collapsed.has('__chat__') && 'rotate-90')}><ChevronIcon /></button>
          <button type="button" onClick={() => { onSwitchProject(null); onNavigate('chat'); }} className="flex flex-1 items-center gap-1.5 text-left">
            <ChatIcon /><span className={cn('text-[12px]', !currentProjectId ? 'text-white' : 'text-gray-300')}>Chat 模式</span>
          </button>
        </div>
        {!collapsed.has('__chat__') && (groupedSessions.get('__chat__') ?? []).map((session) => (
          <DesktopSessionRow
            key={session.id}
            session={session}
            activity={activityBySessionId.get(session.id)}
            management={managementBySessionId.get(session.id)}
            managementActions={managementActions}
            active={session.id === currentSessionId && activeView === 'chat'}
            onSwitch={() => selectSession(session.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectRow({ project, active, collapsed, confirming, onToggle, onSelect, onConfirm, onDelete }: {
  project: Project; active: boolean; collapsed: boolean; confirming: boolean;
  onToggle: () => void; onSelect: () => void; onConfirm: (value: boolean) => void; onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-[#2a2a2a]/40">
      <button type="button" aria-label={`${collapsed ? '展开' : '收起'} ${project.name}`} onClick={onToggle} className={cn('text-gray-500 transition-transform', !collapsed && 'rotate-90')}><ChevronIcon /></button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <FolderIcon /><span className={cn('min-w-0 flex-1 truncate text-[12px]', active ? 'text-white' : 'text-gray-300')}>{project.name}</span>
        <span className="text-[9px] text-gray-600">{formatRelativeTime(project.updatedAt)}</span>
      </button>
      {confirming ? <>
        <button type="button" onClick={onDelete} className="rounded bg-red-600 px-1 py-0.5 text-[8px] text-white">确认</button>
        <button type="button" onClick={() => onConfirm(false)} className="rounded bg-[#333] px-1 py-0.5 text-[8px] text-gray-400">取消</button>
      </> : (
        <button type="button" aria-label={`删除 ${project.name}`} onClick={() => onConfirm(true)} className="text-gray-600 opacity-0 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"><TrashIcon /></button>
      )}
    </div>
  );
}
