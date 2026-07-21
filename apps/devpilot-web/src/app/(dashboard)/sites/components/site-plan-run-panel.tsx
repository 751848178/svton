/** 站点计划与运行记录面板 - 展示最近同步运行 + 当前计划详情。 */
'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { Site, SiteSyncPlan, SiteSyncRun } from '../types';
import type { useSites } from '../hooks/use-sites';
import {
  getStatusLabel,
  getRunModeLabel,
  formatRunLogPreview,
  readLogMessages,
  formatDateTime,
} from '../utils-format';

type SitesHook = ReturnType<typeof useSites>;

interface SitePlanRunPanelProps {
  site: Site;
  sites: SitesHook;
  plan?: SiteSyncPlan;
  recentRuns: SiteSyncRun[];
}

export function SitePlanRunPanel({ site, sites, plan, recentRuns }: SitePlanRunPanelProps) {
  const t = useTranslations('sites');
  return (
    <>
      {recentRuns.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">{t('recentSyncRuns')}</div>
            <div className="text-xs text-muted-foreground">{t('runCount', { count: recentRuns.length })}</div>
          </div>
          <div className="space-y-2">
            {recentRuns.slice(0, 4).map((run) => {
              const canRollback = run.mode === 'sync' && run.status === 'completed' && !run.dryRun;

              return (
                <div
                  key={run.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
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
                      {run.operationApproval && (
                        <StatusTag
                          status={run.operationApproval.status}
                          label={`${t('approvalPrefix')}${getStatusLabel(run.operationApproval.status)}`}
                        />
                      )}
                      {run.serverExecutionJob && (
                        <Link
                          href="/execution-governance"
                          className="text-primary hover:underline"
                        >
                          Job {run.serverExecutionJob.id.slice(0, 8)} ·{' '}
                          {getStatusLabel(run.serverExecutionJob.status)}
                        </Link>
                      )}
                      <span className="text-muted-foreground">{formatDateTime(run.startedAt)}</span>
                    </div>
                    <div className="truncate font-mono text-muted-foreground">
                      {run.targetConfigPath || t('noConfigPathRecorded')}
                    </div>
                    {run.configDiff?.summary && (
                      <div className="text-muted-foreground">{run.configDiff.summary}</div>
                    )}
                    {run.error && <div className="text-destructive">{run.error}</div>}
                    {formatRunLogPreview(run.logs) && (
                      <pre className="mt-2 max-h-28 overflow-auto rounded bg-background p-2 text-muted-foreground">
                        {formatRunLogPreview(run.logs)}
                      </pre>
                    )}
                  </div>
                  {canRollback && (
                    <button
                      onClick={() => sites.handleRollback(site, run)}
                      disabled={sites.rollingBackId === run.id}
                      className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {sites.rollingBackId === run.id
                        ? sites.queueSiteRuns
                          ? t('requestEnqueuing')
                          : t('requesting')
                        : sites.queueSiteRuns
                          ? t('requestRollbackEnqueue')
                          : t('requestRollback')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {plan && (
        <div className="mt-4 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">
              {plan.executorKey} · {plan.adapterKey} · {plan.mode}
            </div>
            <StatusTag
              status={plan.status || (plan.executable ? 'active' : 'pending')}
              label={getStatusLabel(plan.status || (plan.executable ? 'active' : 'pending'))}
            />
          </div>

          {plan.error && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {plan.error}
            </div>
          )}

          {formatRunLogPreview(plan.logs) && (
            <pre className="mt-3 max-h-36 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              {formatRunLogPreview(plan.logs)}
            </pre>
          )}

          {plan.approval && (
            <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
              {t('approvalGenerated', { id: plan.approval.id, status: getStatusLabel(plan.approval.status) })}
            </div>
          )}

          {plan.configDiff && (
            <div className="mt-3 rounded-md border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium">{t('configDiff')}</span>
                <span className="text-muted-foreground">
                  +{plan.configDiff.added} / -{plan.configDiff.removed} / =
                  {plan.configDiff.unchanged}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{plan.configDiff.summary}</div>
              <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-background p-3 text-xs">
                {plan.configDiff.unifiedDiff}
              </pre>
            </div>
          )}

          {plan.warnings.length > 0 && (
            <div className="mt-3 space-y-1 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
              {plan.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          )}

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              {plan.commandPlan.map((step) => (
                <div
                  key={step.key}
                  className="rounded-md bg-muted/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{step.label}</span>
                    <span className="text-muted-foreground">{step.required ? t('required') : t('optional')}</span>
                  </div>
                  <code className="mt-1 block whitespace-pre-wrap break-all text-xs text-muted-foreground">
                    {step.command || t('noCommandNeeded')}
                  </code>
                </div>
              ))}
            </div>
            {plan.nginxConfig ? (
              <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                {plan.nginxConfig}
              </pre>
            ) : (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                {t('noNginxConfig')}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
