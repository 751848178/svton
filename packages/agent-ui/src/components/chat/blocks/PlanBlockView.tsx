import React, { useState } from 'react';
import { ChevronIcon, PlanIcon, cn } from '@svton/ui';
import { PlanStepStatusIcon } from '../PlanStepStatusIcon';

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
    <div className={cn('my-1 overflow-hidden rounded-lg border border-border bg-card', className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
        aria-expanded={expanded}
      >
        <PlanIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 truncate text-xs font-medium text-foreground">{plan.title}</span>
        <span className="text-[10px] text-muted-foreground">{done}/{total}</span>
        {/* Progress bar */}
        <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-status-success transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ChevronIcon size={14} className={cn('text-muted-foreground transition-transform', expanded && 'rotate-90')} aria-hidden="true" />
      </button>

      {/* Steps */}
      {expanded && (
        <div className="space-y-0.5 border-t border-border px-3 py-1.5">
          {plan.steps.map((step) => {
            return (
              <div key={step.id} className="flex items-center gap-1.5 text-[11px] py-0.5">
                <PlanStepStatusIcon status={step.status} />
                <span className={cn('truncate', step.status === 'completed' ? 'text-muted-foreground' : 'text-foreground')}>
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
