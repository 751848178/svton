/**
 * 发布阶段动作按钮（F383, invest-3 §E.6）
 *
 * 单一职责：根据 deriveStageActions 渲染重试 / 跳过 / 重新请求审批 按钮，
 * 不可用时 disabled 并以 title= 展示原因（flag off / 无权限 / 状态不符等）。
 */
'use client';

import { Button } from '@/components/ui';
import { deriveStageActions } from '../utils/release-stage-actions.utils';
import type { ReleaseCapability, ReleaseStage } from '../types/releases';

export interface ReleaseStageActionsProps {
  stage: ReleaseStage;
  planStatus: string;
  capability: ReleaseCapability | null;
  loadingAction?: string | null;
  onRetry?: (stageId: string) => void;
  onSkip?: (stageId: string) => void;
  onReRequestApproval?: (stageId: string) => void;
}

export function ReleaseStageActions({
  stage,
  planStatus,
  capability,
  loadingAction,
  onRetry,
  onSkip,
  onReRequestApproval,
}: ReleaseStageActionsProps): JSX.Element {
  const actions = deriveStageActions(stage, planStatus, capability);
  const canReRequest =
    capability?.enabled !== false &&
    capability?.canWrite !== false &&
    stage.status === 'blocked' &&
    stage.executorKind === 'manual_gate';

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button
        size="sm"
        onClick={() => onRetry?.(stage.id)}
        disabled={!actions.retry.enabled}
        title={actions.retry.reason || undefined}
        loading={loadingAction === `retry:${stage.id}`}
      >
        重试
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onSkip?.(stage.id)}
        disabled={!actions.skip.enabled}
        title={actions.skip.reason || undefined}
        loading={loadingAction === `skip:${stage.id}`}
      >
        跳过（可选）
      </Button>
      {canReRequest && onReRequestApproval && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReRequestApproval(stage.id)}
          title="重新生成待审批"
          loading={loadingAction === `reapprove:${stage.id}`}
        >
          重新请求审批
        </Button>
      )}
    </div>
  );
}
