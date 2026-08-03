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
// CR-3-F4：移除 'failed'——状态机禁止 failed→skipped（release-state-machine.utils.ts），
// 旧实现把 failed 列入 SKIPTABLE 会让 skip 按钮亮起，点击后端总是 409。failed 只能 retry。
const SKIPTABLE = ['pending', 'blocked', 'awaiting_approval'];

/** 推导单个阶段的可执行动作 + 不可用原因。 */
export function deriveStageActions(
  stage: ReleaseStage,
  planStatus: string,
  capability: ReleaseCapability | null,
): ReleaseStageActionView {
  const flagOn = capability?.enabled !== false;
  const canWrite = capability?.canWrite !== false; // 未加载或未提供 projectId 时按可写处理
  const latestAttempt = stage.attempts?.[0];
  const retryInFlight =
    latestAttempt && ['pending', 'queued', 'running'].includes(latestAttempt.status);

  const retry: ReleaseStageAction = (() => {
    if (!flagOn) return { enabled: false, reason: '发布编排未启用' };
    if (!canWrite) return { enabled: false, reason: '无写权限' };
    if (retryInFlight) return { enabled: false, reason: '已有重试正在排队或执行' };
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
