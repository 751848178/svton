'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTimeMinute } from '@/lib/format-date';
import type { DeploymentRun } from '../types/operations';
import {
  releaseApprovalStatusLabelKey,
  releaseEnvironmentValueLabelKey,
  releaseRiskLabelKey,
  releaseRunStatusLabelKey,
} from '../utils/release-copy.model';
import { DeployVarPreview } from './deploy-var-preview';
import { DeploymentStageTimeline } from './deployment-stage-timeline.component';
import { ReleaseSiteProbeEvidence } from './release-site-probe-evidence';
import { parseRunProbeEvidence } from './settings/settings-env-routes.model';
import { isTerminalRunStatus } from '../utils/run-labels';

const MAX_RAW_LENGTH = 12_000;

export function DeploymentRunDetails({ run }: { run: DeploymentRun }) {
  const t = useTranslations('projects');
  const environmentKey = releaseEnvironmentValueLabelKey(
    run.projectEnvironment?.key || run.environment,
  );
  const probeEvidence = parseRunProbeEvidence(run);
  const facts = [
    [t('runDetailMode'), run.dryRun ? t('runModePlanOnly') : t('runModeLiveRequest')],
    // DEP-8：目标类型枚举本地化，不再裸露 release-artifact/server。
    [t('runDetailTarget'), runTargetTypeLabel((key) => t(key as never), run.targetType)],
    [
      t('runDetailEnvironment'),
      environmentKey ? t(environmentKey) : run.projectEnvironment?.name || run.environment || '-',
    ],
    [t('runDetailApplication'), run.application?.name || '-'],
    [t('runDetailService'), run.applicationService?.name || '-'],
    [t('runDetailServer'), run.server ? `${run.server.name} (${run.server.host})` : '-'],
    [t('runDetailStarted'), formatDateTimeMinute(run.startedAt)],
    [t('runDetailFinished'), run.finishedAt ? formatDateTimeMinute(run.finishedAt) : '-'],
  ];
  return (
    <div className="mt-3 space-y-4 border-t pt-3">
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([label, value]) => (
          <div
            key={label}
            className="rounded-md bg-muted/40 p-2"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            {/* DEP-10：长 token（服务器名/URI）truncate+title，替代 break-all 折词。 */}
            <dd
              className="mt-1 truncate text-sm font-medium"
              title={String(value)}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <StateEvidence run={run} />
      <section>
        <h4 className="text-sm font-medium">{t('runDetailPlan')}</h4>
        <DeploymentStageTimeline run={run} />
      </section>
      <DeployVarPreview
        run={run}
        t={t}
      />
      {probeEvidence ? (
        <ReleaseSiteProbeEvidence
          projectId={run.projectId}
          siteProbe={probeEvidence.siteProbe}
          routeSwitch={probeEvidence.routeSwitch}
        />
      ) : null}
      {run.error ? (
        <RawEvidence
          title={t('runDetailError')}
          value={run.error}
          tone="danger"
        />
      ) : null}
      {run.logs ? (
        <RawEvidence
          title={t('runDetailLogs')}
          value={run.logs}
        />
      ) : null}
      {run.result ? (
        <RawEvidence
          title={t('runDetailResult')}
          value={run.result}
        />
      ) : null}
    </div>
  );
}

function StateEvidence({ run }: { run: DeploymentRun }) {
  const t = useTranslations('projects');
  const approval = run.operationApproval || run.releaseRun?.operationApproval;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <section className="rounded-md border p-3">
        <h4 className="text-sm font-medium">{t('runDetailApproval')}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {approval
            ? t('runDetailApprovalState', {
                status: t(releaseApprovalStatusLabelKey(approval.status)),
                risk: t(releaseRiskLabelKey(approval.risk)),
              })
            : t('runDetailNoApproval')}
        </p>
      </section>
      <section className="rounded-md border p-3">
        <h4 className="text-sm font-medium">{t('runDetailExecution')}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {run.serverExecutionJob
            ? t('runDetailExecutionState', {
                status: t(releaseRunStatusLabelKey(run.serverExecutionJob.status)),
                attempt: run.serverExecutionJob.attempt,
                max: run.serverExecutionJob.maxAttempts,
              })
            : run.dryRun
              ? t('runDetailPlanNotExecuted')
              : /* DEP-2：已完成/已失败的历史运行没有回溯的执行任务属正常（任务关联
                 上线前的存量数据），不能再自称「等待审批」。仅未终态运行才提示
                 可能等待审批或被门禁阻断。 */
                isTerminalRunStatus(run.status)
                ? t('runDetailExecutionNoTrace')
                : t('runDetailExecutionNotCreated')}
        </p>
      </section>
    </div>
  );
}

function RawEvidence({ title, value, tone }: { title: string; value: unknown; tone?: 'danger' }) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const content = raw.length > MAX_RAW_LENGTH ? `${raw.slice(0, MAX_RAW_LENGTH)}\n…` : raw;
  // DEP-6：结构化日志数组（[{level,message}]）先逐行渲染，原始 JSON 保留在下方折叠。
  const logLines = parseLogLines(value);
  return (
    <details
      className={`rounded-md border p-3 ${tone === 'danger' ? 'border-destructive/30' : ''}`}
    >
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      {logLines.length ? (
        <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto rounded bg-muted p-2 font-mono text-xs">
          {logLines.map((line, index) => (
            <li
              key={index}
              className={line.level === 'error' ? 'text-destructive' : undefined}
            >
              {line.message}
            </li>
          ))}
        </ul>
      ) : null}
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-xs">
        {content}
      </pre>
    </details>
  );
}

function parseLogLines(value: unknown): Array<{ level: string; message: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item && typeof item === 'object' && 'message' in item) {
      const record = item as Record<string, unknown>;
      return [
        {
          level: String(record.level ?? 'info'),
          message: String(record.message ?? ''),
        },
      ];
    }
    return [];
  });
}

/** DEP-8：部署目标类型枚举 → 本地化标签（i18n:check 保证 key 齐全）。 */
function runTargetTypeLabel(
  t: (key: string) => string,
  targetType: string | null | undefined,
): string {
  if (!targetType) return '-';
  const normalized = targetType.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return t(`runTargetType_${normalized}`);
}
