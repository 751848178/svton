/**
 * 发布计划结论头（F383, invest-3 §E.2/F.4）
 *
 * 单一职责：渲染计划级状态/分支/提交/环境/操作者、当前结论 + 推荐下一步 + 阻塞，
 * 以及执行/取消按钮（带 ConfirmDialog，受 capability 与计划状态门控）。
 */
'use client';

import { useState } from 'react';
import { Card } from '@svton/ui';
import { Button, StatusTag } from '@/components/ui';
import { ReleaseExecuteDialog } from './release-execute-dialog.component';
import { ReleaseCancelDialog } from './release-cancel-dialog.component';
import { ReleaseNextActions } from './release-next-actions.component';
import { PLAN_STATUS_LABEL, pickLabel } from '../utils/release-labels';
import { formatDuration } from '../utils/release-time.utils';
import type { deriveConclusion } from '../utils/release-conclusion.utils';
import type { ReleaseCapability, ReleasePlan, ReleasePlanPreview } from '../types/releases';

type Conclusion = ReturnType<typeof deriveConclusion>;

export interface ReleaseConclusionHeaderProps {
  plan: ReleasePlan;
  conclusion: Conclusion;
  capability: ReleaseCapability | null;
  preview: ReleasePlanPreview | null;
  loadingExecute: boolean;
  loadingCancel: boolean;
  onExecute: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}

export function ReleaseConclusionHeader(props: ReleaseConclusionHeaderProps): JSX.Element {
  const {
    plan,
    conclusion,
    capability,
    preview,
    loadingExecute,
    loadingCancel,
    onExecute,
    onCancel,
  } = props;
  const [showExecute, setShowExecute] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const flagOn = capability?.enabled !== false;
  const canWrite = capability?.canWrite !== false;
  // 执行：仅 ready/blocked 计划可执行；flag 关闭或无写权限则禁用。
  const canExecute = flagOn && canWrite && ['ready', 'blocked'].includes(plan.status);
  // 取消：逃生通道，flag 关闭仍可用（capability.canCancel 恒真），仅非终态可取消。
  const canCancel =
    capability?.canCancel !== false && !['succeeded', 'failed', 'canceled'].includes(plan.status);
  const envName = plan.environment?.name ?? plan.environmentId.slice(-6);
  return (
    <Card>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag
            status={plan.status}
            label={pickLabel(PLAN_STATUS_LABEL, plan.status)}
          />
          <span className="text-sm font-medium">{plan.name}</span>
          {plan.branch && (
            <span className="text-xs text-muted-foreground">分支：{plan.branch}</span>
          )}
          {plan.commitSha && (
            <span className="text-xs text-muted-foreground">
              提交：{plan.commitSha.slice(0, 8)}
            </span>
          )}
          <span className="text-xs text-muted-foreground">环境：{envName}</span>
          {plan.createdBy && (
            <span className="text-xs text-muted-foreground">
              操作者：{plan.createdBy.name ?? plan.createdBy.email}
            </span>
          )}
          {plan.startedAt && (
            <span className="text-xs text-muted-foreground">
              总耗时：{formatDuration(plan.startedAt, plan.finishedAt)}
            </span>
          )}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">当前结论：</span>
          {conclusion.summary}
        </div>
        <ReleaseNextActions plan={plan} />
        <div className="text-sm">
          <span className="text-muted-foreground">推荐下一步：</span>
          {conclusion.nextAction}
        </div>
        {conclusion.blocked && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
            <span className="font-medium text-destructive">需先解决：</span>
            {conclusion.blocked}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {canExecute ? (
            <Button
              onClick={() => setShowExecute(true)}
              loading={loadingExecute}
            >
              开始执行
            </Button>
          ) : null}
          {canCancel && (
            <Button
              variant="outline"
              onClick={() => setShowCancel(true)}
              loading={loadingCancel}
            >
              取消发布
            </Button>
          )}
        </div>
      </div>
      <ReleaseExecuteDialog
        open={showExecute}
        onOpenChange={setShowExecute}
        planName={plan.name}
        environmentName={envName}
        preview={preview}
        onConfirm={onExecute}
      />
      <ReleaseCancelDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        planName={plan.name}
        onConfirm={onCancel}
      />
    </Card>
  );
}
