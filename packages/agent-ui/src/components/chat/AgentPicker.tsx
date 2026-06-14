import React, { useState, useRef, useEffect } from 'react';

export interface AgentDefinitionOption {
  name: string;
  title: string;
  description: string;
  icon?: string;
  color?: string;
}

export interface AgentPickerProps {
  agents: AgentDefinitionOption[];
  current: string | null;
  onSelect: (name: string) => void;
  className?: string;
}

/**
 * A dropdown component for selecting custom agent definitions.
 * Uses simple CSS positioning — no external popover library.
 */
export const AgentPicker: React.FC<AgentPickerProps> = ({
  agents,
  current,
  onSelect,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentAgent = agents.find((a) => a.name === current) ?? null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div ref={containerRef} className={`svton-agent-picker relative inline-block ${className ?? ''}`}>
      {/* Trigger button */}
      <button
        className="svton-agent-picker-trigger flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] transition-colors"
        onClick={() => setOpen(!open)}
      >
        {currentAgent?.icon && (
          <span style={{ color: currentAgent.color ?? '#888' }} className="text-sm">
            {currentAgent.icon}
          </span>
        )}
        <span className="text-gray-300">
          {currentAgent?.title ?? 'Select Agent'}
        </span>
        <span className="text-gray-500 text-[10px] ml-0.5">{open ? '▴' : '▾'}</span>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className="svton-agent-picker-menu absolute right-0 top-full mt-1 min-w-[240px] max-w-[320px] rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl z-50 overflow-hidden"
        >
          {/* Default / None option */}
          <button
            className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#222] transition-colors ${
              current === null ? 'bg-[#222]' : ''
            }`}
            onClick={() => {
              onSelect('');
              setOpen(false);
            }}
          >
            <span className="text-gray-500 text-sm">◇</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-gray-400">Default Agent</div>
              <div className="text-[10px] text-gray-600 truncate">Standard agent without customization</div>
            </div>
            {current === null && (
              <span className="text-[10px] text-cyan-400 flex-shrink-0">✓</span>
            )}
          </button>

          {/* Divider */}
          {agents.length > 0 && (
            <div className="h-px bg-[#252525]" />
          )}

          {/* Agent options */}
          {agents.map((agent) => (
            <button
              key={agent.name}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#222] transition-colors ${
                current === agent.name ? 'bg-[#222]' : ''
              }`}
              onClick={() => {
                onSelect(agent.name);
                setOpen(false);
              }}
            >
              {agent.icon ? (
                <span
                  style={{ color: agent.color ?? '#888' }}
                  className="text-sm flex-shrink-0"
                >
                  {agent.icon}
                </span>
              ) : (
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px]"
                  style={{ backgroundColor: agent.color ?? '#444' }}
                >
                  {agent.title.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-300 truncate">{agent.title}</div>
                <div className="text-[10px] text-gray-500 truncate">{agent.description}</div>
              </div>
              {current === agent.name && (
                <span className="text-[10px] text-cyan-400 flex-shrink-0">✓</span>
              )}
            </button>
          ))}

          {/* Empty state */}
          {agents.length === 0 && (
            <div className="px-3 py-3 text-[10px] text-gray-600 text-center">
              No custom agents defined
            </div>
          )}
        </div>
      )}
    </div>
  );
};
