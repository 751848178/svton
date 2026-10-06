import type { ReleaseGateCatalog, ReleaseGateDecisionStage } from '../types/release-gate.types';
import { humanizeGateReason } from '../utils/release-display.utils';

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
      reason: targetReason(catalog.targetReadiness.reasonCode, locale, catalog.targetReadiness.expectedProviderKey),
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
  // ROD-5：reason 可能内嵌 raw ISO 时间戳（会作为发布钮禁用原因上屏），统一本地化。
  const reason = check
    ? humanizeGateReason(locale.startsWith('zh') ? check.reason.zh : check.reason.en)
    : null;
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
  expectedProviderKey?: string,
) {
  const provider = providerTypeName(expectedProviderKey, locale);
  const reasons = {
    TARGET_READY: ['部署目标已就绪', 'Deployment target is ready'],
    TARGET_MISSING: [
      'Staging 尚未绑定部署目标，请在 项目配置 → 部署目标 中绑定',
      'Staging has no deployment target; bind one in Project configuration → Deployment targets',
    ],
    TARGET_DUPLICATED: [
      'Staging 绑定了多个部署目标，请保留一个后再发布',
      'Staging has duplicate deployment targets; keep one before publishing',
    ],
    PROVIDER_MISMATCH: [
      `预发（Staging）绑定的部署目标类型与本次发布要求的不一致（需要 ${provider}）`,
      `The Staging deployment target type does not match what this release requires (${provider})`,
    ],
    SSH_ROOT_INVALID: [
      '部署目标的 SSH 根目录缺失或不安全，请检查部署目标设置',
      'The deployment target SSH root is missing or unsafe; check the target settings',
    ],
    SSH_CONNECTION_INVALID: [
      '部署目标的 SSH 服务器未在线或连接信息无效，请检查服务器连接',
      'The deployment target SSH server is offline or its connection settings are invalid',
    ],
  } as const;
  return locale.startsWith('zh') ? reasons[code][0] : reasons[code][1];
}

/** Provider key → 用户可理解的部署目标类型名。 */
function providerTypeName(key: string | undefined, locale: string) {
  const zh = locale.startsWith('zh');
  if (key === 'ssh-v1') return zh ? 'SSH 服务器' : 'SSH server';
  if (key === 'local-filesystem-v1') return zh ? '本机目录' : 'local directory';
  return key ?? (zh ? '指定类型' : 'the required type');
}

function local(locale: string, zh: string, en: string) {
  return locale.startsWith('zh') ? zh : en;
}
