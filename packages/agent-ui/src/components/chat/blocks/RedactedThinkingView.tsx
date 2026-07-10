import React from 'react';
import { cn } from '@svton/ui';

interface RedactedThinkingViewProps {
  reason?: string;
  className?: string;
}

/**
 * Inline redacted thinking block — placeholder for sensitive/redacted reasoning content.
 * Mirrors Claude's redacted_thinking content blocks.
 */
export const RedactedThinkingView: React.FC<RedactedThinkingViewProps> = ({ reason, className }) => {
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg border border-[#383838] bg-[#181818] my-1',
      className,
    )}>
      <span className="text-gray-600 text-xs flex-shrink-0">🔒</span>
      <span className="text-[11px] text-gray-600">
        Thinking content redacted
      </span>
      {reason && (
        <span className="text-[10px] text-gray-700 truncate">· {reason}</span>
      )}
    </div>
  );
};
