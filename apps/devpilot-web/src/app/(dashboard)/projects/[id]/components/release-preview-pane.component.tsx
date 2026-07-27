/**
 * 发布预览面板（F383, invest-3 §C.2）
 *
 * 单一职责：渲染 dry-run 预览的阶段/风险/副作用/需审批/planHash 摘要。
 * 纯展示组件，无状态。
 */
'use client';

import { StatusTag } from '@/components/ui';
import { RISK_LABEL, pickLabel } from '../utils/release-labels';
import type { ReleasePlanPreview } from '../types/releases';

export interface ReleasePreviewPaneProps {
  preview: ReleasePlanPreview;
}

export function ReleasePreviewPane({ preview }: ReleasePreviewPaneProps): JSX.Element {
  return (
    <div className="space-y-2 rounded border bg-muted/30 p-3">
      <div className="text-sm font-medium">
        预览：{preview.stages.length} 个阶段（planHash {preview.planHash.slice(0, 8)}）
      </div>
      <div className="flex flex-wrap gap-2">
        {preview.stages.map((s) => (
          <StatusTag
            key={s.key}
            variant="risk"
            status={s.riskLevel}
            label={`${s.name}（${pickLabel(RISK_LABEL, s.riskLevel)}）`}
          />
        ))}
      </div>
      {preview.sideEffects.length > 0 && (
        <div className="text-xs text-muted-foreground">
          副作用：{preview.sideEffects.length} 项（含数据/结构变更）
        </div>
      )}
      {preview.approvalRequired.length > 0 && (
        <div className="text-xs text-muted-foreground">
          需审批阶段：{preview.approvalRequired.length}
        </div>
      )}
    </div>
  );
}
