/**
 * 发布阶段卡片（F383）
 *
 * 单一职责：渲染单个发布阶段的输入、依赖、状态、尝试、输出、日志、错误、
 * 关联运行和当前可执行动作。不支持的动作 disabled 并解释原因。
 */
'use client';

import { useMemo } from 'react';
import { Card } from '@svton/ui';
import { Button, StatusTag, CodeBlock } from '@/components/ui';
import type { ReleaseStage } from '../types/releases';

const SKIP_CONFIRMIRMATION_TEXT = '我确认跳过此可选阶段';

export interface ReleaseStageCardProps {
  stage: ReleaseStage;
  isPlanExecutable: boolean;
  planStatus: string;
  onRetry?: (stageId: string) => void;
  onSkip?: (stageId: string, reason: string) => void;
  loadingAction?: string | null;
}

const STAGE_TYPE_LABEL: Record<string, string> = {
  precheck: '配置校验',
  schema_migration: '数据库结构迁移',
  bootstrap: '生产 bootstrap',
  data_backfill: '历史数据回填',
  application_deploy: '应用部署',
  health_check: '就绪检查',
  manual_gate: '人工门禁',
  custom_command: '自定义命令',
};

export function ReleaseStageCard({
  stage,
  isPlanExecutable,
  planStatus,
  onRetry,
  onSkip,
  loadingAction,
}: ReleaseStageCardProps) {
  const latestAttempt = stage.attempts?.[0] ?? null;
  const durationLabel = useMemo(() => {
    if (!latestAttempt?.startedAt) return null;
    const start = new Date(latestAttempt.startedAt).getTime();
    const end = latestAttempt.finishedAt
      ? new Date(latestAttempt.finishedAt).getTime()
      : Date.now();
    const secs = Math.max(0, Math.round((end - start) / 1000));
    return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
  }, [latestAttempt]);

  const canRetry = stage.status === 'failed' && isPlanExecutable && planStatus === 'running';
  const canSkip =
    !stage.required &&
    ['pending', 'blocked', 'failed'].includes(stage.status) &&
    isPlanExecutable;

  const blockedReason = stage.blockedReason;
  const outputPreview = latestAttempt?.output
    ? JSON.stringify(latestAttempt.output, null, 2)
    : null;

  return (
    <Card
      title={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-medium">{stage.name}</span>
          <div className="flex items-center gap-2">
            <StatusTag variant="risk" status={stage.riskLevel} label={stage.riskLevel} />
            <StatusTag status={stage.status} />
            {stage.required ? (
              <span className="text-xs text-muted-foreground">必需</span>
            ) : (
              <span className="text-xs text-muted-foreground">可选</span>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
          <span>类型：{STAGE_TYPE_LABEL[stage.type] ?? stage.type}</span>
          <span>执行器：{stage.executorKind}</span>
          {durationLabel && <span>耗时：{durationLabel}</span>}
          <span>尝试次数：{stage.currentAttempt}</span>
        </div>

        {stage.dependencies && stage.dependencies.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">依赖</div>
            <div className="flex flex-wrap gap-2">
              {stage.dependencies.map((dep) => (
                <span
                  key={dep.id}
                  className="px-2 py-0.5 rounded bg-muted text-xs"
                  title={`条件：${dep.conditionType}`}
                >
                  ← {dep.dependsOnStageId.slice(-6)}（{dep.conditionType}）
                </span>
              ))}
            </div>
          </div>
        )}

        {blockedReason && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
            <span className="font-medium text-destructive">阻塞：</span>
            {blockedReason}
          </div>
        )}

        {latestAttempt?.error && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
            <span className="font-medium text-destructive">错误：</span>
            {latestAttempt.error}
          </div>
        )}

        {outputPreview && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">结构化输出</div>
            <CodeBlock
              content={outputPreview}
              language="json"
              tone="muted"
              className="max-h-48 overflow-auto"
            />
          </div>
        )}

        {latestAttempt && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {latestAttempt.deploymentRunId && (
              <span>关联部署运行：{latestAttempt.deploymentRunId.slice(-8)}</span>
            )}
            {latestAttempt.serverExecutionJobId && (
              <span>关联执行任务：{latestAttempt.serverExecutionJobId.slice(-8)}</span>
            )}
            {latestAttempt.operationApprovalId && (
              <span>审批单：{latestAttempt.operationApprovalId.slice(-8)}</span>
            )}
          </div>
        )}

        {(canRetry || canSkip) && (
          <div className="flex gap-2 pt-1">
            {canRetry && (
              <Button
                size="sm"
                onClick={() => onRetry?.(stage.id)}
                loading={loadingAction === `retry:${stage.id}`}
              >
                重试
              </Button>
            )}
            {canSkip && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onSkip?.(stage.id, '用户在界面跳过该可选阶段（需确认文本）')
                }
                loading={loadingAction === `skip:${stage.id}`}
              >
                跳过（可选）
              </Button>
            )}
          </div>
        )}

        {!canRetry && !canSkip && !['succeeded', 'skipped', 'canceled'].includes(stage.status) && (
          <div className="text-xs text-muted-foreground">
            {stage.status === 'awaiting_approval'
              ? '等待审批通过后自动推进'
              : stage.status === 'running' || stage.status === 'queued'
                ? '正在执行，请等待关联运行完成'
                : '当前不可执行（依赖未满足或发布未运行）'}
          </div>
        )}
      </div>
    </Card>
  );
}
