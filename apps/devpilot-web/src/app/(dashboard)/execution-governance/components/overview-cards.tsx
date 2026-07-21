/**
 * 执行治理首屏聚合卡
 *
 * 单一职责:把 Supervisor / Jobs / Leases 三域指标收敛为 4 张聚合卡。
 * 视觉样式与全局 MetricCard 完全一致(rounded-lg border p-4 + text-2xl 数值),
 * 额外支持一行 hint 副文案与异常色调 —— 全局 MetricCard 契约仅 (label, value: number),
 * 无法承载 正常/降级/失败 拆分与成功率副行,故在此扩展。
 */

'use client';

import { useTranslations } from 'next-intl';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';
import { summarizeSupervisorHealth } from '../supervisor-health.utils';
import type { JobStats, LeaseStats } from '../hooks/use-execution-governance';

interface GovernanceOverviewProps {
  supervisor: ServerExecutionSupervisorSnapshot | null;
  jobStats: JobStats;
  leaseStats: LeaseStats;
}

type OverviewTone = 'default' | 'warning' | 'danger';

export function GovernanceOverview({ supervisor, jobStats, leaseStats }: GovernanceOverviewProps) {
  const t = useTranslations('executionGovernance');
  const health = supervisor ? summarizeSupervisorHealth(supervisor) : null;
  const supervisorAttention = health ? health.degraded + health.failed : 0;
  const jobAttention = jobStats.stale + jobStats.blocked + jobStats.failed;
  const leaseAttention = leaseStats.expired + leaseStats.failed;
  const attention = supervisorAttention + jobAttention + leaseAttention;
  const finished = jobStats.completed + jobStats.failed;
  const successRate = finished > 0 ? `${Math.round((jobStats.completed / finished) * 100)}%` : '-';

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <OverviewCard
        label={t('ovSupervisorHealth')}
        value={health ? `${health.ok}/${health.total}` : '-'}
        hint={health ? t('ovHealthHint', { degraded: health.degraded, failed: health.failed }) : t('supervisorUnavailable')}
        tone={health && health.failed > 0 ? 'danger' : health && health.degraded > 0 ? 'warning' : 'default'}
      />
      <OverviewCard
        label={t('ovJobs')}
        value={jobStats.total}
        hint={t('ovJobsHint', { rate: successRate, failed: jobStats.failed })}
        tone={jobStats.failed > 0 ? 'warning' : 'default'}
      />
      <OverviewCard
        label={t('ovLeases')}
        value={leaseStats.running}
        hint={t('ovLeasesHint', {
          expired: leaseStats.expired,
          blocked: leaseStats.blocked,
          failed: leaseStats.failed,
        })}
        tone={leaseAttention > 0 ? 'warning' : 'default'}
      />
      <OverviewCard
        label={t('ovAttention')}
        value={attention}
        hint={t('ovAttentionHint', {
          jobs: jobAttention,
          leases: leaseAttention,
          supervisor: supervisorAttention,
        })}
        tone={attention > 0 ? 'danger' : 'default'}
      />
    </div>
  );
}

function OverviewCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: OverviewTone;
}) {
  const valueClass = tone === 'danger' ? 'text-red-600' : tone === 'warning' ? 'text-yellow-700' : '';
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
