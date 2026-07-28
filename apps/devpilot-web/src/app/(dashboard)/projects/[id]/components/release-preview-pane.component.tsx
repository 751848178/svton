/**
 * 发布预览面板（F383, invest-3 §C.2 + P0-1 §7）
 *
 * 单一职责：渲染 dry-run 预览的阶段/风险/副作用/需审批/planHash 摘要，
 * 以及跨服务依赖的人能理解的描述（如「Backend 就绪检查成功后，才会部署 Admin」）。
 * 纯展示组件，无状态。
 */
'use client';

import { useMemo } from 'react';
import { StatusTag } from '@/components/ui';
import { RISK_LABEL, pickLabel, STAGE_TYPE_LABEL } from '../utils/release-labels';
import { describeCrossServiceDependencies } from '../utils/release-dependency-label.utils';
import type { ReleasePlanPreview } from '../types/releases';

export interface ReleasePreviewPaneProps {
  preview: ReleasePlanPreview;
}

// stage key 形如 "<type>:<serviceId>"；用 serviceId 占位为「服务」标签（仅用于
// 跨服务边分组的视觉区分，真实服务名由 stage.name 承载）。
function serviceIdOf(key: string): string {
  const idx = key.indexOf(":");
  return idx >= 0 ? key.slice(idx + 1) : key;
}

export function ReleasePreviewPane({ preview }: ReleasePreviewPaneProps): JSX.Element {
  const depDescriptions = useMemo(() => {
    const stageViews = preview.stages.map((s) => ({
      key: s.key,
      name: s.name,
      type: s.type,
      applicationServiceName: serviceIdOf(s.key),
    }));
    return describeCrossServiceDependencies(preview.dependencies, stageViews);
  }, [preview.dependencies, preview.stages]);

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
      {depDescriptions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-foreground">跨服务依赖</div>
          {depDescriptions.map((d, i) => (
            <div key={i} className="text-xs text-muted-foreground">{d}</div>
          ))}
        </div>
      )}
      {preview.sideEffects.length > 0 && (
        <div className="text-xs text-muted-foreground">
          副作用：{preview.sideEffects.length} 项（含数据/结构变更）
        </div>
      )}
      {preview.approvalRequired.length > 0 && (
        <div className="text-xs text-muted-foreground">
          需审批阶段：{preview.approvalRequired.length}（{preview.approvalRequired
            .map((a) => pickLabel(STAGE_TYPE_LABEL, a.stageKey.split(":")[0]))
            .join("、")}）
        </div>
      )}
    </div>
  );
}
