'use client';

import React, { useRef, useState } from 'react';

export type PermissionMode =
  | 'read_only'
  | 'plan'
  | 'default'
  | 'accept_edits'
  | 'auto';

interface ChatInputControlsProps {
  modelSelector: React.ReactNode;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  planMode: boolean;
  plugins: Array<{ name: string; enabled: boolean }>;
  onPluginToggle: (name: string, enabled: boolean) => void;
}

const PERMISSION_MODES: Array<{
  id: PermissionMode;
  label: string;
  description: string;
}> = [
  { id: 'read_only', label: '只读', description: '只读，不执行任何操作' },
  { id: 'plan', label: '计划', description: '只做计划，不执行' },
  { id: 'default', label: '默认', description: '需要确认才执行' },
  { id: 'accept_edits', label: '接受编辑', description: '自动接受文件编辑' },
  { id: 'auto', label: '全自动', description: '自动执行所有操作' },
];

export function ChatInputControls({
  modelSelector,
  permissionMode,
  onPermissionModeChange,
  planMode,
  plugins,
  onPluginToggle,
}: ChatInputControlsProps) {
  const [permissionOpen, setPermissionOpen] = useState(false);
  const permissionRef = useRef<HTMLDivElement>(null);
  const current = PERMISSION_MODES.find((mode) => mode.id === permissionMode)
    ?? PERMISSION_MODES[2];

  return (
    <>
      {modelSelector}
      <div ref={permissionRef} className="relative flex-shrink-0">
        <button
          onClick={() => setPermissionOpen((open) => !open)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border transition-colors ${
            planMode
              ? 'bg-amber-900/30 border-amber-700/50 text-amber-400'
              : 'bg-[#222] border-[#333] text-gray-400 hover:text-gray-200 hover:bg-[#333]'
          }`}
        >
          {planMode ? '⚡ Plan' : current.label}
          <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor" className="text-gray-500">
            <path d="M3 5l3 3 3-3H3z" />
          </svg>
        </button>
        {permissionOpen && (
          <div className="absolute bottom-full left-0 mb-1 w-48 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-50 py-1">
            {PERMISSION_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  onPermissionModeChange(mode.id);
                  setPermissionOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                  mode.id === permissionMode
                    ? 'text-white bg-[#2a2a2a]'
                    : 'text-gray-400 hover:bg-[#2a2a2a]/60 hover:text-gray-200'
                }`}
              >
                <div className="font-medium">{mode.label}</div>
                <div className="text-[10px] text-gray-500">{mode.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      {plugins.length > 0 && (
        <PluginToggles plugins={plugins} onToggle={onPluginToggle} />
      )}
    </>
  );
}

function PluginToggles({
  plugins,
  onToggle,
}: {
  plugins: Array<{ name: string; enabled: boolean }>;
  onToggle: (name: string, enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md bg-[#222] hover:bg-[#333] text-gray-400 hover:text-gray-200 border border-[#333] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a2 2 0 0 1 2 2v1h2a2 2 0 0 1 2 2v2h1a2 2 0 0 1 0 4h-1v2a2 2 0 0 1-2 2h-2v-1a2 2 0 0 0-4 0v1H4a2 2 0 0 1-2-2v-2H1a2 2 0 0 1 0-4h1V6a2 2 0 0 1 2-2h2V3a2 2 0 0 1 2-2z" />
        </svg>
        插件
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-44 bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-50 py-1">
          {plugins.map((plugin) => (
            <label key={plugin.name} className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-400 hover:bg-[#2a2a2a]/60 cursor-pointer">
              <input
                type="checkbox"
                checked={plugin.enabled}
                onChange={(event) => onToggle(plugin.name, event.target.checked)}
                className="rounded"
              />
              <span className={plugin.enabled ? 'text-gray-200' : 'text-gray-500'}>
                {plugin.name}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
