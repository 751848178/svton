import React, { useState } from 'react';
import { cn } from '@svton/ui';

interface SubagentBlockViewProps {
  agentId: string;
  task: string;
  status: 'running' | 'completed';
  summary?: string;
  className?: string;
}

/**
 * Inline subagent delegation block — shows task + status + expandable summary.
 */
export const SubagentBlockView: React.FC<SubagentBlockViewProps> = ({
  task,
  status,
  summary,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isRunning = status === 'running';

  return (
    <div className={cn('rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] overflow-hidden my-1', className)}>
      <button
        onClick={() => summary && setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
          summary && 'hover:bg-[#222] cursor-pointer',
        )}
      >
        <span className="text-xs flex-shrink-0">🤖</span>
        <span className="text-[11px] text-gray-400 truncate flex-1">{task}</span>
        {isRunning ? (
          <span className="text-[10px] text-blue-400 animate-pulse flex-shrink-0">● 运行中</span>
        ) : (
          <span className="text-[10px] text-green-400 flex-shrink-0">✓ 完成</span>
        )}
        {summary && (
          <span className="text-gray-500 text-[10px] flex-shrink-0">
            {expanded ? '▾' : '▸'}
          </span>
        )}
      </button>
      {expanded && summary && (
        <div className="px-3 py-2 border-t border-[#252525]">
          <p className="text-[11px] text-gray-400 leading-relaxed whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  );
};
