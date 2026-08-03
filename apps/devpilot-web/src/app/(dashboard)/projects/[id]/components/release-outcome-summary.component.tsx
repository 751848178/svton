/**
 * 发布终态结果摘要。
 *
 * 单一职责：汇总阶段结果、部署运行和健康检查证据。
 */

import { Card } from '@svton/ui';
import { formatDuration } from '../utils/release-time.utils';
import type { ReleasePlan } from '../types/releases';

export function ReleaseOutcomeSummary({ plan }: { plan: ReleasePlan }): JSX.Element | null {
  if (!['succeeded', 'failed', 'canceled'].includes(plan.status)) return null;
  const stages = plan.stages ?? [];
  const succeeded = stages.filter((stage) => stage.status === 'succeeded').length;
  const failed = stages.filter((stage) => stage.status === 'failed').length;
  const skipped = stages.filter((stage) => stage.status === 'skipped').length;
  const deploymentRuns = new Set(
    stages.flatMap((stage) =>
      (stage.attempts ?? []).map((attempt) => attempt.deploymentRunId).filter(Boolean),
    ),
  ).size;
  const healthStages = stages.filter((stage) => stage.type === 'health_check');
  const healthSucceeded = healthStages.filter((stage) => stage.status === 'succeeded').length;

  return (
    <Card>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <Fact
          label="阶段结果"
          value={`${succeeded} 成功 / ${failed} 失败 / ${skipped} 跳过`}
        />
        <Fact
          label="部署运行"
          value={`${deploymentRuns} 条`}
        />
        <Fact
          label="发布后验证"
          value={`${healthSucceeded}/${healthStages.length} 健康检查成功`}
        />
        <Fact
          label="目标环境"
          value={plan.environment?.name ?? plan.environmentId.slice(-8)}
        />
        <Fact
          label="总耗时"
          value={formatDuration(plan.startedAt, plan.finishedAt) ?? '-'}
        />
      </div>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
