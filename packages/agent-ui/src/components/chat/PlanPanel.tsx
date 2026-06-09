import React from 'react';
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

interface PlanPanelProps {
  plan: PlanInfo;
  className?: string;
}

const STATUS_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  completed: { icon: '✓', color: 'text-green-400', bg: 'bg-green-900/30' },
  in_progress: { icon: '●', color: 'text-blue-400 animate-pulse', bg: 'bg-blue-900/30' },
  failed: { icon: '✗', color: 'text-red-400', bg: 'bg-red-900/30' },
  skipped: { icon: '—', color: 'text-gray-500', bg: 'bg-[#222]' },
  pending: { icon: '○', color: 'text-gray-500', bg: '' },
};

/**
 * Inline plan progress panel shown in the chat.
 */
export const PlanPanel: React.FC<PlanPanelProps> = ({ plan, className }) => {
  const total = plan.steps.length;
  const done = plan.steps.filter((s) => s.status === 'completed').length;
  const failed = plan.steps.filter((s) => s.status === 'failed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn('mx-4 mb-1 rounded-lg border [#2a2a2a] bg-[#1c1c1c] overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <span className="text-xs font-semibold gray-300">{plan.title}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{done}/{total} {t('plan.completed')}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 [#222]">
        <div
          className={cn('h-full transition-all duration-300', failed > 0 ? 'bg-orange-400' : 'bg-green-400')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <div className="px-3 py-1.5 space-y-0.5">
        {plan.steps.map((step) => {
          const style = STATUS_STYLE[step.status] || STATUS_STYLE.pending;
          return (
            <div key={step.id} className={cn('flex items-center gap-1.5 text-[11px] rounded px-1 py-0.5', style.bg)}>
              <span className={cn('flex-shrink-0 text-[10px]', style.color)}>{style.icon}</span>
              <span className={cn(
                'truncate',
                step.status === 'completed' ? 'text-gray-400 line-through' :
                step.status === 'pending' ? 'text-gray-400' :
                'text-gray-300',
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
