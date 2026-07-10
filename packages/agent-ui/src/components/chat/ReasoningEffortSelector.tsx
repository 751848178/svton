import React, { useState, useRef, useEffect } from 'react';

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | undefined;

export interface ReasoningEffortSelectorProps {
  value: ReasoningEffort;
  onChange: (value: ReasoningEffort) => void;
  className?: string;
}

const EFFORT_OPTIONS: Array<{
  value: ReasoningEffort;
  label: string;
  icon: string;
  hint: string;
}> = [
  { value: undefined, label: 'Auto', icon: '◇', hint: 'Let the model decide' },
  { value: 'low', label: 'Low', icon: '▸', hint: 'Fast, minimal reasoning' },
  { value: 'medium', label: 'Medium', icon: '▸▸', hint: 'Balanced speed and depth' },
  { value: 'high', label: 'High', icon: '▸▸▸', hint: 'Deeper reasoning, slower' },
  { value: 'xhigh', label: 'Xhigh', icon: '▸▸▸▸', hint: 'Maximum reasoning effort' },
];

/**
 * A compact inline dropdown for selecting reasoning effort level.
 * Opens a small menu with effort options.
 */
export const ReasoningEffortSelector: React.FC<ReasoningEffortSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = EFFORT_OPTIONS.find((o) => o.value === value) ?? EFFORT_OPTIONS[0];

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
    <div ref={containerRef} className={`svton-reasoning-effort relative inline-block ${className ?? ''}`}>
      {/* Trigger button */}
      <button
        className="svton-reasoning-effort-trigger flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-gray-400 hover:text-gray-300 hover:bg-[#2a2a2a] border border-transparent hover:border-[#383838] transition-colors"
        onClick={() => setOpen(!open)}
        title={`Reasoning: ${selectedOption.label}`}
      >
        <span className="text-[10px] text-gray-500">{selectedOption.icon}</span>
        <span className="text-gray-400">{selectedOption.label}</span>
        <span className="text-gray-600 text-[8px] ml-0.5">{open ? '▴' : '▾'}</span>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="svton-reasoning-effort-menu absolute right-0 top-full mt-1 min-w-[180px] rounded-lg border border-[#383838] bg-[#252525] shadow-xl z-50 overflow-hidden py-0.5">
          {EFFORT_OPTIONS.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.label}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[#2a2a2a] transition-colors ${
                  isSelected ? 'bg-[#2a2a2a]' : ''
                }`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="text-[10px] text-gray-500 w-8 text-center flex-shrink-0">
                  {option.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs ${isSelected ? 'text-cyan-400' : 'text-gray-300'}`}>
                    {option.label}
                  </div>
                  <div className="text-[9px] text-gray-600 truncate">{option.hint}</div>
                </div>
                {isSelected && (
                  <span className="text-[10px] text-cyan-400 flex-shrink-0">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
