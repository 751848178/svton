import type { ReleaseGateDecision } from '../types/release-gate.types';

export interface ReleaseGateDecisionCounts {
  /** 硬阻断：blocker 门禁 + 目录完整性错误。 */
  blocked: number;
  warning: number;
  /** 待人工确认：manual 门禁扣除已确认项（「待确认」是独立于「阻断」的维度）。 */
  manual: number;
}

/**
 * ROD-1 门禁计数单一事实源：决策卡、高级检查折叠头、技术证据 tab 的
 * 「阻断/警告/待确认」全部从同一份 stage 决策派生，避免三处口径漂移
 * （历史：阻断 3 / 5 / 0 分别来自 blocker、blocker+全量 manual、check 状态计数）。
 */
export function buildReleaseGateDecisionCounts(
  decision: ReleaseGateDecision | null | undefined,
): ReleaseGateDecisionCounts {
  if (!decision) return { blocked: 0, warning: 0, manual: 0 };
  const confirmed = new Set(decision.confirmedManualGateIds ?? []);
  return {
    blocked: (decision.blockerGateIds?.length ?? 0) + (decision.integrityErrors?.length ?? 0),
    warning: decision.warningGateIds?.length ?? 0,
    manual: (decision.manualGateIds ?? []).filter((gateId) => !confirmed.has(gateId)).length,
  };
}
