import React from 'react';
import { cn } from '@svton/ui';

export interface TurnSeparatorProps {
  /** Optional elapsed time label (e.g. "Worked for 2m") */
  label?: string;
  className?: string;
}

/**
 * Thin horizontal divider between conversation turns.
 * Codex-style: full-width dim line, optional centered label.
 */
export const TurnSeparator: React.FC<TurnSeparatorProps> = ({ label, className }) => {
  if (!label) {
    return (
      <div className={cn('border-t border-[#222]', className)} />
    );
  }

  return (
    <div className={cn('flex items-center gap-3 px-6 py-1', className)}>
      <div className="flex-1 border-t border-[#222]" />
      <span className="text-[11px] text-gray-400 whitespace-nowrap">{label}</span>
      <div className="flex-1 border-t border-[#222]" />
    </div>
  );
};
