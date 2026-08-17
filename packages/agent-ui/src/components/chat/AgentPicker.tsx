import React, { useState, useRef, useEffect } from 'react';
import { AgentIcon, ChevronIcon, CompletedIcon, cn, useI18n } from '@svton/ui';

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
  const { translate: t } = useI18n();
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
        className="svton-agent-picker-trigger flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs transition-colors hover:bg-accent"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <AgentIcon size={14} className="text-muted-foreground" aria-hidden="true" />
        <span className="text-foreground">
          {currentAgent?.title ?? t('agent.select')}
        </span>
        <ChevronIcon size={14} className={cn('ml-0.5 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden="true" />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          className="svton-agent-picker-menu absolute right-0 top-full z-50 mt-1 min-w-[240px] max-w-[320px] overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        >
          {/* Default / None option */}
          <button
            className={cn('flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent', current === null && 'bg-accent')}
            onClick={() => {
              onSelect('');
              setOpen(false);
            }}
          >
            <AgentIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground">{t('agent.default')}</div>
              <div className="truncate text-[10px] text-muted-foreground">{t('agent.defaultDescription')}</div>
            </div>
            {current === null && (
              <CompletedIcon size={14} className="shrink-0 text-status-success" aria-hidden="true" />
            )}
          </button>

          {/* Divider */}
          {agents.length > 0 && (
            <div className="h-px bg-border" />
          )}

          {/* Agent options */}
          {agents.map((agent) => (
            <button
              key={agent.name}
              className={cn('flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent', current === agent.name && 'bg-accent')}
              onClick={() => {
                onSelect(agent.name);
                setOpen(false);
              }}
            >
              <AgentIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-foreground">{agent.title}</div>
                <div className="truncate text-[10px] text-muted-foreground">{agent.description}</div>
              </div>
              {current === agent.name && (
                <CompletedIcon size={14} className="shrink-0 text-status-success" aria-hidden="true" />
              )}
            </button>
          ))}

          {/* Empty state */}
          {agents.length === 0 && (
            <div className="px-3 py-3 text-center text-[10px] text-muted-foreground">
              {t('agent.empty')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
