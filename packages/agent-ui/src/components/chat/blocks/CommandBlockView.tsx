import React from 'react';
import { cn } from '@svton/ui';

interface CommandBlockViewProps {
  label: string;
  action: string;
  icon?: string;
  className?: string;
  onCommand?: (action: string) => void;
}

/**
 * Inline command button — renders an actionable button in the message stream.
 * The action string identifies what should happen when clicked.
 */
export const CommandBlockView: React.FC<CommandBlockViewProps> = ({
  label,
  action,
  icon,
  className,
  onCommand,
}) => {
  return (
    <button
      onClick={() => onCommand?.(action)}
      disabled={!onCommand}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] transition-all my-0.5',
        onCommand
          ? 'border-[#3B82F6]/30 bg-[#3B82F6]/10 text-blue-400 hover:bg-[#3B82F6]/20 hover:border-[#3B82F6]/50 cursor-pointer'
          : 'border-[#2a2a2a] bg-[#1c1c1c] text-gray-500 cursor-default',
        className,
      )}
    >
      {icon && <span className="text-xs">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};
