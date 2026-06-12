import React from 'react';
import { cn } from '@svton/ui';

export interface TurnSeparatorProps {
  /** Optional elapsed time label (e.g. "2.1k in → 1.8k out") */
  label?: string;
  className?: string;
}

/**
 * Soft turn separator between conversation turns.
 * Minimal, low-contrast — stays out of the way like Codex.
 */
export const TurnSeparator: React.FC<TurnSeparatorProps> = ({ label, className }) => {
  if (!label) {
    return (
      <div className={cn('mx-16 py-1.5', className)}>
        <div className="border-t border-[#1e1e1e]" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 px-10 py-1.5', className)}>
      <div className="flex-1 h-px bg-[#1e1e1e]" />
      <span className="text-[10px] text-gray-600 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-[#1e1e1e]" />
    </div>
  );
};
