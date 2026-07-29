import React, { useRef, useState } from 'react';
import { cn } from '@svton/ui';
import type { ReasoningEffort } from '@svton/agent-ui';
import type { ModelOption } from '../types';
import type { AgentShellPermissionMode } from './agent-shell-permission.utils';

interface AgentShellToolbarProps {
  models: ModelOption[];
  currentModel: string;
  permissionMode: AgentShellPermissionMode;
  reasoningEffort: ReasoningEffort;
  onModelChange: (model: string) => void;
  onPermissionModeChange: (mode: AgentShellPermissionMode) => void;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
}

export function AgentShellToolbar({
  models,
  currentModel,
  permissionMode,
  reasoningEffort,
  onModelChange,
  onPermissionModeChange,
  onReasoningEffortChange,
}: AgentShellToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[#222]">
      <ModelSelector
        models={models}
        currentModel={currentModel}
        onChange={onModelChange}
      />
      <div className="flex items-center gap-2">
        <select
          value={permissionMode}
          onChange={(event) => {
            const mode = parsePermissionMode(event.target.value);
            if (mode) onPermissionModeChange(mode);
          }}
          className="bg-[#1c1c1c] text-gray-400 text-[11px] rounded px-2 py-1 border border-[#2a2a2a] outline-none cursor-pointer hover:text-gray-200"
        >
          <option value="read_only">只读</option>
          <option value="plan">计划</option>
          <option value="default">默认</option>
          <option value="accept_edits">接受编辑</option>
          <option value="auto">全自动</option>
        </select>
        <select
          value={reasoningEffort ?? 'auto'}
          onChange={(event) => onReasoningEffortChange(
            parseReasoningEffort(event.target.value),
          )}
          className="bg-[#1c1c1c] text-gray-400 text-[11px] rounded px-2 py-1 border border-[#2a2a2a] outline-none cursor-pointer hover:text-gray-200"
        >
          <option value="auto">Auto</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="xhigh">Xhigh</option>
        </select>
      </div>
    </div>
  );
}

interface ModelSelectorProps {
  models: ModelOption[];
  currentModel: string;
  onChange: (model: string) => void;
}

function ModelSelector({
  models,
  currentModel,
  onChange,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const current = models.find((model) => model.key === currentModel)
    ?? models.find((model) => model.id === currentModel);
  const providers = [...new Set(models.map((model) => model.providerName))];

  return (
    <div ref={dropRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[13px] text-gray-300 hover:text-white"
      >
        <span className="text-gray-500">{current?.providerName}</span>
        <span className="font-medium">{current?.name || currentModel}</span>
        <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 5l3 3 3-3H3z" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-[#1c1c1c] rounded-lg border border-[#2a2a2a] shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
          {providers.map((providerName) => (
            <div key={providerName}>
              <div className="px-3 py-1 text-[10px] text-gray-600 uppercase">
                {providerName}
              </div>
              {models
                .filter((model) => model.providerName === providerName)
                .map((model) => (
                  <button
                    key={model.key}
                    onClick={() => {
                      onChange(model.key);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#222] transition-colors',
                      model.key === currentModel || model.id === currentModel
                        ? 'text-cyan-400'
                        : 'text-gray-400',
                    )}
                  >
                    {model.name}
                    {(model.key === currentModel || model.id === currentModel)
                      && <span className="float-right">✓</span>}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function parsePermissionMode(value: string): AgentShellPermissionMode | null {
  if (
    value === 'read_only'
    || value === 'plan'
    || value === 'default'
    || value === 'accept_edits'
    || value === 'auto'
  ) {
    return value;
  }
  return null;
}

function parseReasoningEffort(value: string): ReasoningEffort {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh') {
    return value;
  }
  return undefined;
}
