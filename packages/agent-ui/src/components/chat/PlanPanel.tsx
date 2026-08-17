import React from 'react';
import { cn, useI18n } from '@svton/ui';
import { PlanStepStatusIcon, planStepSurface } from './PlanStepStatusIcon';

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

interface PlanPanelProps {
  plan: PlanInfo;
  className?: string;
}

/**
 * Inline plan progress panel shown in the chat.
 */
export const PlanPanel: React.FC<PlanPanelProps> = ({ plan, className }) => {
  const { translate: t } = useI18n();
  const total = plan.steps.length;
  const done = plan.steps.filter((s) => s.status === 'completed').length;
  const failed = plan.steps.filter((s) => s.status === 'failed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn('mx-4 mb-1 overflow-hidden rounded-lg border border-border bg-card', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">{plan.title}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{done}/{total} {t('plan.completed')}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className={cn('h-full transition-all duration-300 motion-reduce:transition-none', failed > 0 ? 'bg-status-warning' : 'bg-status-success')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <div className="px-3 py-1.5 space-y-0.5">
        {plan.steps.map((step) => {
          return (
            <div key={step.id} className={cn('flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px]', planStepSurface(step.status))}>
              <PlanStepStatusIcon status={step.status} />
              <span className={cn(
                'truncate',
                step.status === 'completed' ? 'text-muted-foreground line-through' :
                step.status === 'pending' ? 'text-muted-foreground' :
                'text-foreground',
              )}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
