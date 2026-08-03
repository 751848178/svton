/**
 * 发布阶段卡片（F383, invest-3 §E.2）
 *
 * 单一职责：渲染单个阶段的状态/风险/类型/输入快照/真实目标环境与服务器/
 * 人类可读依赖/尝试状态与次数/结构化输出/日志/错误/耗时/关联运行入口/阻塞原因。
 * 展开时挂载 ReleaseAttemptDetails + ReleaseStageActions；收起时仅头部摘要。
 * 支持 stageId 深链：defaultExpanded 由 tab host 依据 ?stageId= 传入。
 */
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import {
  DEPENDENCY_CONDITION_LABEL,
  EXECUTOR_KIND_LABEL,
  formatReleaseStageName,
  RISK_LABEL,
  STAGE_STATUS_LABEL,
  STAGE_TYPE_LABEL,
  pickLabel,
} from '../utils/release-labels';
import { ReleaseStageActions } from './release-stage-actions.component';
import { ReleaseAttemptDetails } from './release-attempt-details.component';
import type { ReleaseCapability, ReleasePlan, ReleaseStage } from '../types/releases';

export interface ReleaseStageCardProps {
  stage: ReleaseStage;
  plan: ReleasePlan;
  capability: ReleaseCapability | null;
  /** 深链默认展开（来自 ?stageId=）。 */
  defaultExpanded?: boolean;
  /** 展开/收起时回写 URL（写入 ?stageId=）。 */
  onExpandChange?: (stageId: string, expanded: boolean) => void;
  loadingAction?: string | null;
  onRetry?: (stageId: string) => void;
  onSkip?: (stageId: string) => void;
  onReRequestApproval?: (stageId: string) => void;
}

export function ReleaseStageCard(props: ReleaseStageCardProps): JSX.Element {
  const {
    stage,
    plan,
    capability,
    defaultExpanded = false,
    onExpandChange,
    loadingAction,
    onRetry,
    onSkip,
    onReRequestApproval,
  } = props;
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const latestAttempt = stage.attempts?.[0] ?? null;
  const envName = stage.environmentId
    ? (plan.environment?.name ?? stage.environmentId.slice(-6))
    : '-';
  const deps = stage.dependencies ?? [];
  const configSnapshotText = stage.configSnapshot
    ? JSON.stringify(stage.configSnapshot, null, 2)
    : null;
  const displayName = formatReleaseStageName(stage.name, stage.type);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandChange?.(stage.id, next);
  };

  return (
    <Card
      title={
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="font-medium">{displayName}</span>
          <span className="flex items-center gap-2">
            <StatusTag
              variant="risk"
              status={stage.riskLevel}
              label={pickLabel(RISK_LABEL, stage.riskLevel)}
            />
            <StatusTag
              status={stage.status}
              label={pickLabel(STAGE_STATUS_LABEL, stage.status)}
            />
            <span className="text-xs text-muted-foreground">
              {stage.required ? '必需' : '可选'}
            </span>
            <span className="text-xs text-muted-foreground">{expanded ? '▾' : '▸'}</span>
          </span>
        </button>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
          <span>类型：{pickLabel(STAGE_TYPE_LABEL, stage.type)}</span>
          <span>尝试次数：{stage.currentAttempt}</span>
          <span>目标环境：{envName}</span>
          {stage.applicationServiceId && (
            <span>
              来源：{stage.applicationServiceName ?? stage.applicationServiceId.slice(-6)}
            </span>
          )}
        </div>

        {deps.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-muted-foreground">依赖</div>
            <div className="flex flex-wrap gap-2">
              {deps.map((dep) => (
                <span
                  key={dep.id}
                  className="rounded bg-muted px-2 py-0.5 text-xs"
                  title={`条件：${pickLabel(DEPENDENCY_CONDITION_LABEL, dep.conditionType)}`}
                >
                  ←{' '}
                  {formatReleaseStageName(
                    plan.stages?.find((s) => s.id === dep.dependsOnStageId)?.name ??
                      dep.dependsOnStageId.slice(-6),
                    plan.stages?.find((s) => s.id === dep.dependsOnStageId)?.type,
                  )}
                  （{pickLabel(DEPENDENCY_CONDITION_LABEL, dep.conditionType)}）
                </span>
              ))}
            </div>
          </div>
        )}

        {stage.blockedReason && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
            <span className="font-medium text-destructive">阻塞：</span>
            {stage.blockedReason}
          </div>
        )}

        {expanded && (
          <>
            <details className="rounded border bg-muted/20 p-2 text-xs">
              <summary className="cursor-pointer font-medium">技术输入与执行目标</summary>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <div>执行方式：{pickLabel(EXECUTOR_KIND_LABEL, stage.executorKind)}</div>
                {stage.serverId && <div>目标服务器 ID：{stage.serverId.slice(-8)}</div>}
                {configSnapshotText && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2">
                    {configSnapshotText}
                  </pre>
                )}
              </div>
            </details>
            {latestAttempt ? (
              <ReleaseAttemptDetails
                attempt={latestAttempt}
                plan={plan}
              />
            ) : (
              <div className="text-xs text-muted-foreground">暂无尝试记录</div>
            )}
            <ReleaseStageActions
              stage={stage}
              planStatus={plan.status}
              capability={capability}
              loadingAction={loadingAction}
              onRetry={onRetry}
              onSkip={onSkip}
              onReRequestApproval={onReRequestApproval}
            />
          </>
        )}
      </div>
    </Card>
  );
}
