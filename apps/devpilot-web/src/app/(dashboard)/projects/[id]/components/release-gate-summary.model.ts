import type {
  ReleaseGateCatalog,
  ReleaseGateCheck,
  ReleaseGatePhase,
  ReleaseGateStatus,
} from '../types/release-gate.types';
import {
  RELEASE_GATE_EXPECTED_CAPABILITIES,
  RELEASE_GATE_EXPECTED_COMMIT_MVP,
  RELEASE_GATE_EXPECTED_OWNERS,
  RELEASE_GATE_EXPECTED_PHASE_COUNTS,
  RELEASE_GATE_STATUS_TO_PERSISTED,
} from './release-gate-contract';
import { hasExactBuildDecision } from './release-gate-decision-contract';

export const RELEASE_GATE_PREVIEW_GROUPS = [
  { key: 'source', capabilityIds: ['M01'] },
  { key: 'impact', capabilityIds: ['M02'] },
  { key: 'security', capabilityIds: ['M04'] },
  { key: 'baseline', capabilityIds: ['M06', 'M07'] },
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
  }>;
  capabilities: Array<{
    id: string;
    status: ReleaseGateStatus;
    checkCount: number;
    passingCount: number;
  }>;
}

export function buildReleaseGateSummary(catalog: ReleaseGateCatalog): ReleaseGateSummary {
  const valid = hasExactCatalogShape(catalog);
  const decision = catalog.decisions?.build;
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
      const checks = catalog.checks.filter((check) =>
        group.capabilityIds.some((capabilityId) => capabilityId === check.capabilityId),
      );
      return {
        key: group.key,
        status: aggregateStatus(checks),
        checkCount: checks.length,
        passingCount: passingCount(checks),
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

function hasExactCatalogShape(catalog: ReleaseGateCatalog) {
  const capabilityIds = catalog.capabilities.map((capability) => capability.id).sort();
  const checkIds = catalog.checks.map((check) => check.id).sort();
  const expectedChecks = Object.entries(RELEASE_GATE_EXPECTED_PHASE_COUNTS).flatMap(
    ([phase, count]) => {
      const prefix = { commit: 'C', build: 'B', deploy: 'D', promote: 'P' }[
        phase as ReleaseGatePhase
      ];
      return Array.from({ length: count }, (_, index) => ({
        id: `${prefix}${String(index + 1).padStart(2, '0')}`,
        phase: phase as ReleaseGatePhase,
        ordinal: index + 1,
      }));
    },
  );
  const commitMvpIds = catalog.checks
    .filter((check) => check.phase === 'commit' && check.delivery === 'mvp')
    .map((check) => check.id)
    .sort();
  const phaseCounts = Object.fromEntries(
    Object.keys(RELEASE_GATE_EXPECTED_PHASE_COUNTS).map((phase) => [
      phase,
      catalog.checks.filter((check) => check.phase === phase).length,
    ]),
  ) as Record<ReleaseGatePhase, number>;
  return (
    catalog.summary.total === 51 &&
    catalog.checks.length === 51 &&
    new Set(checkIds).size === 51 &&
    checkIds.join() ===
      expectedChecks
        .map(({ id }) => id)
        .sort()
        .join() &&
    capabilityIds.join() === RELEASE_GATE_EXPECTED_CAPABILITIES.join() &&
    commitMvpIds.join() === RELEASE_GATE_EXPECTED_COMMIT_MVP.join() &&
    expectedChecks.every(({ id, phase, ordinal }) => {
      const check = catalog.checks.find((candidate) => candidate.id === id);
      const owner = RELEASE_GATE_EXPECTED_OWNERS.get(id) ?? null;
      return (
        check?.phase === phase &&
        check.ordinal === ordinal &&
        check.capabilityId === owner &&
        check.delivery === (owner ? 'mvp' : 'target') &&
        check.persistedStatus === RELEASE_GATE_STATUS_TO_PERSISTED[check.status]
      );
    }) &&
    Object.entries(RELEASE_GATE_EXPECTED_PHASE_COUNTS).every(
      ([phase, count]) =>
        phaseCounts[phase as ReleaseGatePhase] === count &&
        catalog.summary.phaseCounts[phase as ReleaseGatePhase] === count,
    ) &&
    Object.keys(RELEASE_GATE_STATUS_TO_PERSISTED).every(
      (status) =>
        catalog.summary.statusCounts[status as ReleaseGateStatus] ===
        catalog.checks.filter((check) => check.status === status).length,
    ) &&
    hasExactBuildDecision(catalog)
  );
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
