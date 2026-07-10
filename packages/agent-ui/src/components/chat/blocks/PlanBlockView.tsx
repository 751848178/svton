import React, { useState } from 'react';
import { cn, t } from '@svton/ui';

export interface PlanStepInfo {
  id: string;
  title: string;
  status: string;
}

export interface PlanInfo {
  planId: string;
  title: string;
  steps: PlanStepInfo[];
}

interface PlanBlockViewProps {
  plan: PlanInfo;
  className?: string;
}

const STEP_STYLE: Record<string, { icon: string; color: string }> = {
  completed: { icon: '✓', color: 'text-green-400' },
  in_progress: { icon: '●', color: 'text-blue-400 animate-pulse' },
  failed: { icon: '✗', color: 'text-red-400' },
  skipped: { icon: '—', color: 'text-gray-600' },
  pending: { icon: '○', color: 'text-gray-500' },
};

/**
 * Inline plan progress block — shows title + progress bar + step list.
 * Follows the PlanPanel visual style but as an inline block.
 */
export const PlanBlockView: React.FC<PlanBlockViewProps> = ({ plan, className }) => {
  const [expanded, setExpanded] = useState(true);
  const total = plan.steps.length;
  const done = plan.steps.filter((s) => s.status === 'completed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn('rounded-lg border border-[#383838] bg-[#2a2a2a] overflow-hidden my-1', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#2a2a2a] transition-colors"
      >
        <span className="text-xs">📋</span>
        <span className="text-xs font-medium text-gray-200 flex-1 truncate">{plan.title}</span>
        <span className="text-[10px] text-gray-500">{done}/{total}</span>
        {/* Progress bar */}
        <div className="w-16 h-1 rounded-full bg-[#333] overflow-hidden">
          <div
            className="h-full bg-green-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-gray-500 text-[10px]">{expanded ? '▾' : '▸'}</span>
      </button>

      {/* Steps */}
      {expanded && (
        <div className="px-3 py-1.5 space-y-0.5 border-t border-[#3a3a3a]">
          {plan.steps.map((step) => {
            const style = STEP_STYLE[step.status] || STEP_STYLE.pending;
            return (
              <div key={step.id} className="flex items-center gap-1.5 text-[11px] py-0.5">
                <span className={cn('flex-shrink-0 text-[10px]', style.color)}>{style.icon}</span>
                <span className={cn('truncate', step.status === 'completed' ? 'text-gray-500' : 'text-gray-300')}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
