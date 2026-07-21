/** Focused Site plan preview and recent run summary. */
'use client';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { SiteSyncPlan, SiteSyncRun } from '../types';
import { formatDateTime, getRunModeLabel, getStatusLabel } from '../utils-format';

interface FocusedSitePlanRunSummaryProps {
  plan: SiteSyncPlan | null;
  recentRuns: SiteSyncRun[];
}

export function FocusedSitePlanRunSummary({ plan, recentRuns }: FocusedSitePlanRunSummaryProps) {
  const t = useTranslations('sites');
  if (!plan && recentRuns.length === 0) return null;

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {plan && (
        <div className="rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium">
              {plan.executorKey} · {plan.adapterKey} · {plan.mode}
            </span>
            <StatusTag
              status={plan.status || (plan.executable ? 'active' : 'pending')}
              label={getStatusLabel(plan.status || (plan.executable ? 'active' : 'pending'))}
            />
          </div>
          {plan.warnings.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-yellow-800">
              {plan.warnings.slice(0, 3).map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          )}
          <div className="mt-2 space-y-2">
            {plan.commandPlan.slice(0, 3).map((step) => (
              <div
                key={step.key}
                className="rounded bg-muted/50 p-2"
              >
                <div className="text-xs font-medium">{step.label}</div>
                <code className="mt-1 block break-all text-xs text-muted-foreground">
                  {step.command || t('noCommandNeeded')}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}
      {recentRuns.length > 0 && (
        <div className="rounded-md border bg-background p-3">
          <div className="mb-2 text-xs font-medium">{t('recentRuns')}</div>
          <div className="space-y-2">
            {recentRuns.slice(0, 3).map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center gap-2 text-xs"
              >
                <span className="font-medium">{getRunModeLabel(run.mode)}</span>
                <StatusTag
                  status={run.status}
                  label={getStatusLabel(run.status)}
                />
                {run.dryRun && (
                  <StatusTag
                    status="info"
                    label="dry-run"
                  />
                )}
                <span className="text-muted-foreground">{formatDateTime(run.startedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
