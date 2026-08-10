import type { ReleaseGateCatalog, ReleaseGateDecisionStage } from '../types/release-gate.types';

export interface ReleaseActionGate {
  allowed: boolean;
  reason: string;
  repairArea?: 'targets';
}

export function releaseActionGate(
  catalog: ReleaseGateCatalog | null,
  stage: ReleaseGateDecisionStage,
  state: { loading: boolean; error: string },
  locale: string,
): ReleaseActionGate {
  if (state.loading)
    return { allowed: false, reason: local(locale, '门禁检查中', 'Checking gates') };
  if (state.error) return { allowed: false, reason: state.error };
  const decision = catalog?.decisions?.[stage];
  if (!decision) {
    return { allowed: false, reason: local(locale, '门禁结论不可用', 'Gate decision unavailable') };
  }
  if (stage === 'staging' && catalog.targetReadiness.matchState !== 'ready') {
    return {
      allowed: false,
      reason: targetReason(catalog.targetReadiness.reasonCode, locale),
      repairArea: 'targets',
    };
  }
  const blockedIds = [
    ...decision.blockerGateIds,
    ...decision.manualGateIds,
    ...decision.deferredGateIds,
  ];
  const allowed =
    decision.allowed && blockedIds.length === 0 && decision.integrityErrors.length === 0;
  if (allowed) return { allowed: true, reason: '' };
  const check = catalog?.checks.find((candidate) => blockedIds.includes(candidate.id));
  const reason = locale.startsWith('zh') ? check?.reason.zh : check?.reason.en;
  return {
    allowed: false,
    reason:
      reason ||
      decision.integrityErrors[0] ||
      local(locale, '前置门禁尚未通过', 'Required gates have not passed'),
  };
}

function targetReason(
  code: ReleaseGateCatalog['targetReadiness']['reasonCode'],
  locale: string,
) {
  const reasons = {
    TARGET_READY: ['部署目标已就绪', 'Deployment target is ready'],
    TARGET_MISSING: ['Staging 尚未绑定部署目标', 'Staging has no deployment target'],
    TARGET_DUPLICATED: ['Staging 存在重复的部署目标绑定', 'Staging has duplicate deployment targets'],
    PROVIDER_MISMATCH: ['部署目标与当前 Provider 不匹配', 'Deployment target does not match the current Provider'],
    SSH_ROOT_INVALID: ['SSH 部署根目录缺失或不安全', 'SSH deployment root is missing or unsafe'],
  } as const;
  return locale.startsWith('zh') ? reasons[code][0] : reasons[code][1];
}

function local(locale: string, zh: string, en: string) {
  return locale.startsWith('zh') ? zh : en;
}
