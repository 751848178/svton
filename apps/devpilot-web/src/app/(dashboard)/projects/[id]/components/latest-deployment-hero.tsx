/**
 * 最近部署 - 英雄卡
 *
 * 单一职责：高亮展示项目最新一次部署运行（状态、来源、分支、环境、
 * 触发者、时间、SHA、失败时的错误）。失败态翻红并内联展示错误。
 * 没有任何运行时展示「立即部署」空态，引导用户触发首次部署。
 *
 * 这是概览 Tab 的第一焦点 —— 回答"最近一次部署结果如何"。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@svton/ui';
import { Button, StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { getProjectEnvironmentLabels } from '@/lib/project-display';
import { getRunStatusLabelKey, getRunSourceLabelKey, shortSha } from '../utils/run-labels';
import type { DeploymentRun } from '../types/operations';

interface LatestDeploymentHeroProps {
  /** 最新部署运行；为空表示项目还没有任何部署。 */
  run: DeploymentRun | null;
  /** 点击「立即部署」/「查看部署历史」的回调（由 page 传入，切到部署 tab）。 */
  onDeployClick?: () => void;
}

export function LatestDeploymentHero({ run, onDeployClick }: LatestDeploymentHeroProps) {
  const t = useTranslations('projects');

  if (!run) {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('latestDeployTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('noDeploymentsCta')}</p>
          </div>
          <Button variant="primary" onClick={onDeployClick}>
            {t('deployAction')}
          </Button>
        </div>
      </Card>
    );
  }

  const statusKey = getRunStatusLabelKey(run.status);
  const sourceKey = getRunSourceLabelKey(run.source);
  const failed = run.status?.toLowerCase() === 'failed' || Boolean(run.error);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">{t('latestDeployTitle')}</h2>
            <StatusTag
              status={run.status}
              label={statusKey ? t(statusKey) : run.status}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t('sourceLabel')}: {sourceKey ? t(sourceKey) : run.source || '-'}
            </span>
            <span>
              {t('branchLabel')}: <span className="font-mono">{run.branch || '-'}</span>
            </span>
            {run.environment ? (
              <span>
                {getProjectEnvironmentLabels({ environments: [run.environment] })[0] ??
                  run.environment}
              </span>
            ) : null}
            {run.actor?.name ? <span>{run.actor.name}</span> : null}
            {shortSha(run.commitSha) ? (
              <span className="font-mono text-xs">{shortSha(run.commitSha)}</span>
            ) : null}
            <span>{formatDateTimeMinute(run.startedAt)}</span>
          </div>
          {failed && run.error ? <RunError error={run.error} t={t} /> : null}
        </div>
        <Button variant="outline" size="sm" onClick={onDeployClick}>
          {t('viewLogs')}
        </Button>
      </div>
    </Card>
  );
}

/** 失败部署的错误展示（可折叠）。 */
function RunError({ error, t }: { error: string; t: ReturnType<typeof useTranslations<'projects'>> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-destructive"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{open ? '▾' : '▸'}</span>
        {t('viewError')}
      </button>
      {open ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-xs text-destructive">
          {error}
        </pre>
      ) : null}
    </div>
  );
}
