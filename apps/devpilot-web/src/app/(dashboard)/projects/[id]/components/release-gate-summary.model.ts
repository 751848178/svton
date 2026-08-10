import type {
  ReleaseGateCatalog,
  ReleaseGateCheck,
  ReleaseGateStatus,
} from '../types/release-gate.types';
import { hasExactReleaseGateCatalog } from './release-gate-catalog-integrity.model';

export const RELEASE_GATE_PREVIEW_GROUPS = [
  { key: 'source', capabilityIds: ['M01'] },
  { key: 'impact', capabilityIds: ['M02'] },
  { key: 'security', capabilityIds: ['M04'] },
  { key: 'baseline', capabilityIds: ['M03'] },
] as const;

export interface ReleaseGateSummary {
  valid: boolean;
  canEnterBuild: boolean;
  blockingCount: number;
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

export function buildReleaseGateSummary(catalog: ReleaseGateCatalog): ReleaseGateSummary {
  const valid = hasExactReleaseGateCatalog(catalog);
  const decision = catalog.decisions?.build;
  const blockedIds = new Set([
    ...(decision?.blockerGateIds ?? []),
    ...(decision?.manualGateIds ?? []),
    ...(decision?.deferredGateIds ?? []),
  ]);
  const blockingCount = decision
    ? decision.blockerGateIds.length +
      decision.manualGateIds.length +
      decision.integrityErrors.length
    : 1;
  return {
    valid,
    canEnterBuild: valid && decision.allowed,
    blockingCount: valid ? blockingCount : Math.max(1, blockingCount),
    capabilityCount: catalog.capabilities.length,
    totalChecks: catalog.checks.length,
    previews: RELEASE_GATE_PREVIEW_GROUPS.map((group) => {
      const checks = catalog.checks.filter(
        (check) =>
          check.phase === decision?.phase &&
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
        primaryReason: (blocked[0] ?? checks.find((check) => check.status !== 'checked'))?.reason ?? null,
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
