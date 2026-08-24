import type {
  ReleaseGateCatalog,
  ReleaseGateCheck,
  ReleaseGateDecisionStage,
  ReleaseGateStatus,
} from '../types/release-gate.types';
import { hasExactReleaseGateCatalog } from './release-gate-catalog-integrity.model';
import { buildReleaseGateDecisionCounts } from './release-gate-decision-counts.model';

export const RELEASE_GATE_PREVIEW_GROUPS = [
  { key: 'source', capabilityIds: ['M01'] },
  { key: 'impact', capabilityIds: ['M02'] },
  { key: 'security', capabilityIds: ['M04'] },
  { key: 'baseline', capabilityIds: ['M03'] },
] as const;

export interface ReleaseGateSummary {
  valid: boolean;
  canEnterBuild: boolean;
  /** 与决策卡/技术证据同源的「阻断」计数（blocker + 完整性错误；待人工另计）。 */
  blockingCount: number;
  manualCount: number;
  capabilityCount: number;
  totalChecks: number;
  previews: Array<{
    key: (typeof RELEASE_GATE_PREVIEW_GROUPS)[number]['key'];
    status: ReleaseGateStatus;
    checkCount: number;
    passingCount: number;
    blockingCount: number;
    primaryReason: ReleaseGateCheck['reason'] | null;
    checkedAt: string | null;
    capabilityIds: readonly string[];
  }>;
  capabilities: Array<{
    id: string;
    status: ReleaseGateStatus;
    checkCount: number;
    passingCount: number;
  }>;
}

/**
 * PX-1 门禁计数单一口径：summary 与组行统计全部取「当前执行阶段决策」
 * （默认 build，工作台传入 decisionStep 对应阶段）。组行不再按决策 phase 过滤，
 * 而是聚合该能力组的全部 MVP 检查——阻断数 = 组内命中该阶段决策 blocker 集合的检查数，
 * 保证 区头计数 = Σ组行阻断 = 预警条计数。
 */
export function buildReleaseGateSummary(
  catalog: ReleaseGateCatalog,
  stage: ReleaseGateDecisionStage = 'build',
): ReleaseGateSummary {
  const valid = hasExactReleaseGateCatalog(catalog);
  const decision = catalog.decisions?.[stage] ?? catalog.decisions?.build;
  const blockedIds = new Set([
    ...(decision?.blockerGateIds ?? []),
    ...(decision?.manualGateIds ?? []),
    ...(decision?.deferredGateIds ?? []),
  ]);
  // ROD-1：阻断计数改由共享 selector 派生（blocker + 完整性错误），不再混入全量 manual 门禁；
  // 目录无效时按失败关闭语义显示至少 1。
  const counts = buildReleaseGateDecisionCounts(decision);
  const blockingCount = valid ? counts.blocked : Math.max(1, counts.blocked);
  return {
    valid,
    canEnterBuild: valid && Boolean(catalog.decisions?.build?.allowed),
    blockingCount,
    manualCount: counts.manual,
    capabilityCount: catalog.capabilities.length,
    totalChecks: catalog.checks.length,
    previews: RELEASE_GATE_PREVIEW_GROUPS.map((group) => {
      const checks = catalog.checks.filter(
        (check) =>
          check.delivery === 'mvp' &&
          group.capabilityIds.some((id) => id === check.capabilityId),
      );
      const blocked = checks.filter((check) => blockedIds.has(check.id));
      return {
        key: group.key,
        status: aggregateStatus(checks),
        checkCount: checks.length,
        passingCount: passingCount(checks),
        blockingCount: blocked.length,
        primaryReason:
          (blocked[0] ?? checks.find((check) => check.status !== 'checked'))?.reason ?? null,
        checkedAt: latestCheckedAt(checks),
        capabilityIds: group.capabilityIds,
      };
    }),
    capabilities: catalog.capabilities.map((capability) => {
      const checks = catalog.checks.filter((check) => check.capabilityId === capability.id);
      return {
        id: capability.id,
        status: aggregateStatus(checks),
        checkCount: checks.length,
        passingCount: passingCount(checks),
      };
    }),
  };
}

export function releaseGateStatusTone(status: ReleaseGateStatus) {
  const tones: Record<ReleaseGateStatus, string> = {
    checked: 'success',
    unchecked: 'progress',
    blocked: 'danger',
    warning: 'warning',
    manual: 'info',
    unavailable: 'neutral',
  };
  return tones[status];
}

function aggregateStatus(checks: ReleaseGateCheck[]): ReleaseGateStatus {
  const priority: ReleaseGateStatus[] = [
    'blocked',
    'unavailable',
    'manual',
    'unchecked',
    'warning',
    'checked',
  ];
  return (
    priority.find((status) => checks.some((check) => check.status === status)) ?? 'unavailable'
  );
}

function passingCount(checks: ReleaseGateCheck[]) {
  return checks.filter((check) => check.status === 'checked' || check.status === 'warning').length;
}

function latestCheckedAt(checks: ReleaseGateCheck[]) {
  return checks.reduce<string | null>((latest, check) => {
    if (!check.checkedAt) return latest;
    return !latest || check.checkedAt > latest ? check.checkedAt : latest;
  }, null);
}
