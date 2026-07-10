import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ReasoningEffort } from '@svton/agent-ui';

type PermissionMode = 'read_only' | 'plan' | 'default' | 'accept_edits' | 'auto';

const REASONING_OPTIONS: Array<{ value: ReasoningEffort; label: string; icon: string; hint: string }> = [
  { value: undefined, label: 'Auto', icon: '◇', hint: '由模型自动决定' },
  { value: 'low', label: 'Low', icon: '▸', hint: '快速，最少的推理' },
  { value: 'medium', label: 'Medium', icon: '▸▸', hint: '速度与深度平衡' },
  { value: 'high', label: 'High', icon: '▸▸▸', hint: '更深入的推理，较慢' },
  { value: 'xhigh', label: 'Xhigh', icon: '▸▸▸▸', hint: '最大推理强度' },
];

const PERMISSION_MODES: Array<{ id: PermissionMode; label: string; desc: string }> = [
  { id: 'read_only', label: '只读', desc: '只能读取文件' },
  { id: 'plan', label: '计划', desc: '只做规划，不执行' },
  { id: 'default', label: '默认', desc: '读写文件需确认' },
  { id: 'accept_edits', label: '接受编辑', desc: '编辑文件无需确认' },
  { id: 'auto', label: '全自动', desc: '无需确认执行所有' },
];

interface PluginInfo {
  name: string;
  enabled: boolean;
}

interface ProjectInfo {
  id: string;
  name: string;
}

interface InputControlsProps {
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  planMode: boolean;
  onPlanModeChange: (enabled: boolean) => void;
  plugins: PluginInfo[];
  onPluginToggle: (name: string, enabled: boolean) => void;
  gitBranch?: string | null;
  projectName?: string | null;
  /** Project list — only passed when conversation is empty (enables project selector) */
  projects?: ProjectInfo[];
  currentProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
  /** Reasoning effort level (low/medium/high/xhigh or undefined for auto) */
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (effort: ReasoningEffort) => void;
}

const cn = (...classes: (string | false | undefined | null)[]) => classes.filter(Boolean).join(' ');

/**
 * Inline input controls: permission mode, plan toggle, plugin dropdown, git branch.
 * Designed to sit inside ChatInput's leadingSlot — a single flex row of compact controls.
 * Uses `fixed` positioning for dropdowns to avoid overflow clipping.
 */
export function InputControls({
  permissionMode,
  onPermissionModeChange,
  planMode,
  onPlanModeChange,
  plugins,
  onPluginToggle,
  gitBranch,
  projectName,
  projects,
  currentProjectId,
  onSelectProject,
  reasoningEffort,
  onReasoningEffortChange,
}: InputControlsProps) {
  const [showPerms, setShowPerms] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const permsBtnRef = useRef<HTMLButtonElement>(null);
  const pluginsBtnRef = useRef<HTMLButtonElement>(null);
  const projectsBtnRef = useRef<HTMLButtonElement>(null);
  const reasoningBtnRef = useRef<HTMLButtonElement>(null);
  const [permsPos, setPermsPos] = useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });
  const [pluginsPos, setPluginsPos] = useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });
  const [projectsPos, setProjectsPos] = useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });
  const [reasoningPos, setReasoningPos] = useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });

  const currentPerm = PERMISSION_MODES.find((m) => m.id === permissionMode) ?? PERMISSION_MODES[2];
  const selectedReasoning = REASONING_OPTIONS.find((o) => o.value === reasoningEffort) ?? REASONING_OPTIONS[0];

  const closeAll = useCallback(() => {
    setShowPerms(false);
    setShowPlugins(false);
    setShowProjects(false);
    setShowReasoning(false);
  }, []);

  const openPerms = useCallback(() => {
    if (permsBtnRef.current) {
      const rect = permsBtnRef.current.getBoundingClientRect();
      setPermsPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
    }
    closeAll();
    setShowPerms(true);
  }, [closeAll]);

  const openPlugins = useCallback(() => {
    if (pluginsBtnRef.current) {
      const rect = pluginsBtnRef.current.getBoundingClientRect();
      setPluginsPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
    }
    closeAll();
    setShowPlugins(true);
  }, [closeAll]);

  const openProjects = useCallback(() => {
    if (projectsBtnRef.current) {
      const rect = projectsBtnRef.current.getBoundingClientRect();
      setProjectsPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
    }
    closeAll();
    setShowProjects(true);
  }, [closeAll]);

  const openReasoning = useCallback(() => {
    if (reasoningBtnRef.current) {
      const rect = reasoningBtnRef.current.getBoundingClientRect();
      setReasoningPos({ left: rect.left, bottom: window.innerHeight - rect.top + 4 });
    }
    closeAll();
    setShowReasoning(true);
  }, [closeAll]);

  // Close popups on outside click
  useEffect(() => {
    if (!showPerms && !showPlugins && !showProjects && !showReasoning) return;
    const fn = (e: MouseEvent) => {
      const target = e.target as Node;
      const permDropEl = document.getElementById('perm-dropdown');
      const pluginDropEl = document.getElementById('plugin-dropdown');
      const projectDropEl = document.getElementById('project-dropdown');
      const reasoningDropEl = document.getElementById('reasoning-dropdown');
      const clickedPermDrop = showPerms && permDropEl?.contains(target);
      const clickedPluginDrop = showPlugins && pluginDropEl?.contains(target);
      const clickedProjectDrop = showProjects && projectDropEl?.contains(target);
      const clickedReasoningDrop = showReasoning && reasoningDropEl?.contains(target);
      const clickedPermBtn = permsBtnRef.current?.contains(target);
      const clickedPluginBtn = pluginsBtnRef.current?.contains(target);
      const clickedProjectBtn = projectsBtnRef.current?.contains(target);
      const clickedReasoningBtn = reasoningBtnRef.current?.contains(target);
      if (!clickedPermDrop && !clickedPermBtn) setShowPerms(false);
      if (!clickedPluginDrop && !clickedPluginBtn) setShowPlugins(false);
      if (!clickedProjectDrop && !clickedProjectBtn) setShowProjects(false);
      if (!clickedReasoningDrop && !clickedReasoningBtn) setShowReasoning(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [showPerms, showPlugins, showProjects, showReasoning]);

  // Find current project name for display
  const activeProject = projects?.find((p) => p.id === currentProjectId);

  return (
    <>
      {/* Divider */}
      <div className="w-px h-4 bg-[#333] flex-shrink-0" />

      {/* Permission mode selector */}
      <button
        ref={permsBtnRef}
        onClick={showPerms ? () => setShowPerms(false) : openPerms}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a]/60 transition-colors flex-shrink-0"
      >
        <ShieldIcon className={permissionMode === 'auto' ? 'text-green-400' : permissionMode === 'read_only' ? 'text-yellow-500' : ''} />
        <span className="text-[11px]">{currentPerm.label}</span>
        <svg width="6" height="6" viewBox="0 0 12 12" fill="currentColor"><path d="M3 5l3 3 3-3H3z" /></svg>
      </button>

      {/* Reasoning effort selector — built-in button + fixed dropdown */}
      {onReasoningEffortChange && (
        <button
          ref={reasoningBtnRef}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={showReasoning ? () => setShowReasoning(false) : openReasoning}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a]/60 transition-colors flex-shrink-0"
        >
          <span className="text-[10px] text-gray-500">{selectedReasoning.icon}</span>
          <span className="text-[11px]">{selectedReasoning.label}</span>
          <svg width="6" height="6" viewBox="0 0 12 12" fill="currentColor"><path d="M3 5l3 3 3-3H3z" /></svg>
        </button>
      )}

      {/* Plan mode toggle */}
      <button
        onClick={() => onPlanModeChange(!planMode)}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors',
          planMode
            ? 'text-amber-300 bg-amber-900/20'
            : 'text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a]/60',
        )}
      >
        <ClipboardIcon />
        <span className="text-[11px]">Plan</span>
      </button>

      {/* Project selector — only when projects are passed (empty conversation) */}
      {projects && projects.length > 0 && (
        <button
          ref={projectsBtnRef}
          onClick={showProjects ? () => setShowProjects(false) : openProjects}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a]/60 transition-colors flex-shrink-0"
        >
          <FolderIcon />
          <span className="text-[11px] max-w-[80px] truncate">{activeProject?.name ?? '选择项目'}</span>
          <svg width="6" height="6" viewBox="0 0 12 12" fill="currentColor"><path d="M3 5l3 3 3-3H3z" /></svg>
        </button>
      )}

      {/* Plugin dropdown */}
      {plugins.length > 0 && (
        <button
          ref={pluginsBtnRef}
          onClick={showPlugins ? () => setShowPlugins(false) : openPlugins}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-[#2a2a2a]/60 transition-colors flex-shrink-0"
        >
          <PlugIcon />
          <span className="text-[11px]">插件</span>
        </button>
      )}

      {/* Project name + git branch — shown when conversation has messages (no project selector) */}
      {!projects && (gitBranch || projectName) && (
        <div className="flex items-center gap-1.5 flex-shrink-0 text-gray-600 ml-1">
          {projectName && (
            <span className="text-[10px] truncate max-w-[100px]">{projectName}</span>
          )}
          {gitBranch && (
            <span className="flex items-center gap-1 text-[10px]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
              {gitBranch}
            </span>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1 min-w-2" />

      {/* Fixed position dropdowns — rendered at portal level to avoid clipping */}
      {showPerms && (
        <div
          id="perm-dropdown"
          style={{ position: 'fixed', left: permsPos.left, bottom: permsPos.bottom, zIndex: 9999, maxHeight: '50vh' }}
          className="w-48 bg-[#2a2a2a] rounded-lg border border-[#383838] shadow-xl py-1 overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {PERMISSION_MODES.map((m) => (
            <button
              key={m.id}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => { onPermissionModeChange(m.id); setShowPerms(false); }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors',
                m.id === permissionMode ? 'bg-cyan-950/30 text-cyan-300' : 'text-gray-400 hover:bg-[#252525] hover:text-gray-200',
              )}
            >
              <div>
                <span className="text-[11px]">{m.label}</span>
                <span className="text-[10px] text-gray-600 ml-2">{m.desc}</span>
              </div>
              {m.id === permissionMode && <span className="text-cyan-400 text-[10px]">&#10003;</span>}
            </button>
          ))}
        </div>
      )}

      {showProjects && (
        <div
          id="project-dropdown"
          style={{ position: 'fixed', left: projectsPos.left, bottom: projectsPos.bottom, zIndex: 9999 }}
          className="w-56 bg-[#2a2a2a] rounded-lg border border-[#383838] shadow-xl py-1 max-h-60 overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] text-gray-600 uppercase tracking-wide">选择项目</div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => { onSelectProject?.(null); setShowProjects(false); }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
              !currentProjectId
                ? 'bg-cyan-950/30 text-cyan-300'
                : 'text-gray-400 hover:bg-[#252525] hover:text-gray-200',
            )}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[11px]">Chat 模式</span>
            {!currentProjectId && <span className="text-cyan-400 text-[10px] ml-auto">&#10003;</span>}
          </button>
          <div className="mx-3 my-1 border-t border-[#383838]" />
          {projects?.map((p) => (
            <button
              key={p.id}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => { onSelectProject?.(p.id); setShowProjects(false); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                p.id === currentProjectId
                  ? 'bg-cyan-950/30 text-cyan-300'
                  : 'text-gray-400 hover:bg-[#252525] hover:text-gray-200',
              )}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-[11px] truncate">{p.name}</span>
              {p.id === currentProjectId && <span className="text-cyan-400 text-[10px] ml-auto">&#10003;</span>}
            </button>
          ))}
        </div>
      )}

      {showPlugins && (
        <div
          id="plugin-dropdown"
          style={{ position: 'fixed', left: pluginsPos.left, bottom: pluginsPos.bottom, zIndex: 9999 }}
          className="w-52 bg-[#2a2a2a] rounded-lg border border-[#383838] shadow-xl py-1 max-h-60 overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {plugins.map((p) => (
            <div key={p.name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#252525]">
              <Toggle checked={p.enabled} onChange={(v) => onPluginToggle(p.name, v)} />
              <span className={cn('text-[11px] flex-1', p.enabled ? 'text-gray-200' : 'text-gray-500')}>{p.name}</span>
            </div>
          ))}
        </div>
      )}

      {showReasoning && (
        <div
          id="reasoning-dropdown"
          style={{ position: 'fixed', left: reasoningPos.left, bottom: reasoningPos.bottom, zIndex: 9999 }}
          className="w-52 bg-[#2a2a2a] rounded-lg border border-[#383838] shadow-xl py-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] text-gray-600 uppercase tracking-wide">推理强度</div>
          {REASONING_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => { onReasoningEffortChange?.(opt.value); setShowReasoning(false); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                opt.value === reasoningEffort ? 'bg-cyan-950/30 text-cyan-300' : 'text-gray-400 hover:bg-[#252525] hover:text-gray-200',
              )}
            >
              <span className="text-[10px] text-gray-500 w-6 text-center">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px]">{opt.label}</div>
                <div className="text-[9px] text-gray-600">{opt.hint}</div>
              </div>
              {opt.value === reasoningEffort && <span className="text-cyan-400 text-[10px]">&#10003;</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'w-6 h-3.5 rounded-full relative transition-colors',
        checked ? 'bg-cyan-600' : 'bg-[#444]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-transform',
          checked ? 'left-[12px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

// ── Inline SVG Icons ────────────────────────────────────────

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6" /><path d="M6 8h12" /><path d="M8 8v4a4 4 0 0 0 8 0V8" /><path d="M12 16v6" />
    </svg>
  );
}
