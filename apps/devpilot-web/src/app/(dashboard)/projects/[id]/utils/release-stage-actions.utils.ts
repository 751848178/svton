/**
 * 发布编排 — 阶段动作可用性推导（F383, invest-3 §E.6）
 *
 * 单一职责：纯谓词，根据「阶段状态 + 计划状态 + capability」推导
 * retry / skip / execute 是否可用，并给出不可用的原因（作为 disabled 按钮 title 提示）。
 */
import type { ReleaseCapability, ReleaseStage } from '../types/releases';

export interface ReleaseStageAction {
  enabled: boolean;
  reason: string;
}

export interface ReleaseStageActionView {
  retry: ReleaseStageAction;
  skip: ReleaseStageAction;
}

const NON_SKIPABLE = ['succeeded', 'skipped', 'canceled', 'running', 'queued', 'ready'];
const SKIPTABLE = ['pending', 'blocked', 'failed', 'awaiting_approval'];

/** 推导单个阶段的可执行动作 + 不可用原因。 */
export function deriveStageActions(
  stage: ReleaseStage,
  planStatus: string,
  capability: ReleaseCapability | null,
): ReleaseStageActionView {
  const flagOn = capability?.enabled !== false;
  const canWrite = capability?.canWrite !== false; // 未加载或未提供 projectId 时按可写处理

  const retry: ReleaseStageAction = (() => {
    if (!flagOn) return { enabled: false, reason: '发布编排未启用' };
    if (!canWrite) return { enabled: false, reason: '无写权限' };
    if (planStatus !== 'running' && planStatus !== 'failed') {
      return { enabled: false, reason: '发布未在执行中' };
    }
    if (stage.status !== 'failed') {
      return { enabled: false, reason: '仅失败阶段可重试' };
    }
    return { enabled: true, reason: '' };
  })();

  const skip: ReleaseStageAction = (() => {
    if (!flagOn) return { enabled: false, reason: '发布编排未启用' };
    if (!canWrite) return { enabled: false, reason: '无写权限' };
    if (stage.required) return { enabled: false, reason: '必需阶段不可跳过' };
    if (NON_SKIPABLE.includes(stage.status)) {
      return { enabled: false, reason: '当前状态不可跳过' };
    }
    if (!SKIPTABLE.includes(stage.status)) {
      return { enabled: false, reason: '当前状态不可跳过' };
    }
    return { enabled: true, reason: '' };
  })();

  return { retry, skip };
}
