/** 项目部署运行面板。 */
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { Button, ErrorBanner, StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { getProjectEnvironmentLabels } from '@/lib/project-display';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

const INITIAL_VISIBLE = 10;

/** 部署运行状态值 → 本地化标签 key（避免 StatusTag 回退显示英文原值）。 */
function getRunStatusLabelKey(status: string): string {
  const s = status.toLowerCase();
  if (s === 'queued') return 'runStatusQueued';
  if (s === 'running') return 'runStatusRunning';
  if (s === 'completed') return 'runStatusCompleted';
  if (s === 'failed') return 'runStatusFailed';
  if (s === 'blocked') return 'runStatusBlocked';
  if (s === 'succeeded' || s === 'success') return 'runStatusSucceeded';
  if (s === 'pending') return 'runStatusPending';
  if (s === 'cancelled' || s === 'canceled') return 'runStatusCancelled';
  return 'runStatusUnknown';
}

/** 部署来源原始值 → 本地化标签 key（未知值返回 null，由调用方回退原值）。 */
function getRunSourceLabelKey(source: string): string | null {
  const s = source.toLowerCase();
  if (s === 'webhook') return 'runSourceWebhook';
  if (s === 'manual') return 'runSourceManual';
  if (s === 'api') return 'runSourceApi';
  if (s === 'schedule' || s === 'scheduled') return 'runSourceSchedule';
  return null;
}

function shortSha(sha: string | null | undefined): string | null {
  if (!sha) return null;
  return sha.length > 8 ? sha.slice(0, 8) : sha;
}

export function DeploymentPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const [expanded, setExpanded] = useState(false);

  if (detail.deploymentError) {
    return (
      <ErrorBanner
        message={detail.deploymentError}
        onRetry={() => detail.loadDeploymentRuns()}
      />
    );
  }
  if (detail.deploymentRuns.length === 0) return <EmptyState text={t('noDeploymentRuns')} />;

  const visible = expanded ? detail.deploymentRuns : detail.deploymentRuns.slice(0, INITIAL_VISIBLE);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold">{t('deploymentRuns')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('deploymentPanelDescription')}</p>
      </div>
      <div className="space-y-2">
        {visible.map((run) => (
          <div
            key={run.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium">
                {t('sourceLabel')}:{' '}
                {(() => {
                  const key = getRunSourceLabelKey(run.source);
                  return key ? t(key) : run.source || '-';
                })()}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {t('branchLabel')}: {run.branch || '-'}
              </span>
              {run.environment ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {getProjectEnvironmentLabels({ environments: [run.environment] })[0] ??
                    run.environment}
                </span>
              ) : null}
              {run.actor?.name ? (
                <span className="ml-2 text-xs text-muted-foreground">{run.actor.name}</span>
              ) : null}
              {shortSha(run.commitSha) ? (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {shortSha(run.commitSha)}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <StatusTag status={run.status} label={t(getRunStatusLabelKey(run.status))} />
              <span className="text-xs text-muted-foreground">
                {formatDateTimeMinute(run.startedAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {detail.deploymentRuns.length > INITIAL_VISIBLE ? (
        <Button
          variant="ghost"
          size="sm"
          block
          className="mt-2"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? t('collapse')
            : t('showAll', { count: detail.deploymentRuns.length })}
        </Button>
      ) : null}
    </div>
  );
}
