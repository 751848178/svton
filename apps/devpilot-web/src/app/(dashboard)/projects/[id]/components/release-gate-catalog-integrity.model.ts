import type { ReleaseGateCatalog, ReleaseGatePhase, ReleaseGateStatus } from '../types/release-gate.types';
import {
  RELEASE_GATE_EXPECTED_CAPABILITIES,
  RELEASE_GATE_EXPECTED_COMMIT_MVP,
  RELEASE_GATE_EXPECTED_OWNERS,
  RELEASE_GATE_EXPECTED_PHASE_COUNTS,
  RELEASE_GATE_STATUS_TO_PERSISTED,
} from './release-gate-contract';
import { hasExactBuildDecision } from './release-gate-decision-contract';

export function hasExactReleaseGateCatalog(catalog: ReleaseGateCatalog) {
  const capabilityIds = catalog.capabilities.map((item) => item.id).sort();
  const checkIds = catalog.checks.map((item) => item.id).sort();
  const expectedChecks = Object.entries(RELEASE_GATE_EXPECTED_PHASE_COUNTS).flatMap(
    ([phase, count]) => expectedPhaseChecks(phase as ReleaseGatePhase, count),
  );
  const commitMvpIds = catalog.checks
    .filter((check) => check.phase === 'commit' && check.delivery === 'mvp')
    .map((check) => check.id)
    .sort();
  return (
    catalog.summary.total === 51 &&
    catalog.checks.length === 51 &&
    new Set(checkIds).size === 51 &&
    checkIds.join() === expectedChecks.map(({ id }) => id).sort().join() &&
    capabilityIds.join() === RELEASE_GATE_EXPECTED_CAPABILITIES.join() &&
    commitMvpIds.join() === RELEASE_GATE_EXPECTED_COMMIT_MVP.join() &&
    expectedChecks.every(({ id, phase, ordinal }) => exactCheck(catalog, id, phase, ordinal)) &&
    exactPhaseCounts(catalog) &&
    exactStatusCounts(catalog) &&
    hasExactBuildDecision(catalog)
  );
}

function expectedPhaseChecks(phase: ReleaseGatePhase, count: number) {
  const prefix = { commit: 'C', build: 'B', deploy: 'D', promote: 'P' }[phase];
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${String(index + 1).padStart(2, '0')}`,
    phase,
    ordinal: index + 1,
  }));
}

function exactCheck(
  catalog: ReleaseGateCatalog,
  id: string,
  phase: ReleaseGatePhase,
  ordinal: number,
) {
  const check = catalog.checks.find((candidate) => candidate.id === id);
  const owner = RELEASE_GATE_EXPECTED_OWNERS.get(id) ?? null;
  return (
    check?.phase === phase &&
    check.ordinal === ordinal &&
    check.capabilityId === owner &&
    check.delivery === (owner ? 'mvp' : 'target') &&
    check.persistedStatus === RELEASE_GATE_STATUS_TO_PERSISTED[check.status]
  );
}

function exactPhaseCounts(catalog: ReleaseGateCatalog) {
  return Object.entries(RELEASE_GATE_EXPECTED_PHASE_COUNTS).every(
    ([phase, count]) =>
      catalog.summary.phaseCounts[phase as ReleaseGatePhase] === count &&
      catalog.checks.filter((check) => check.phase === phase).length === count,
  );
}

function exactStatusCounts(catalog: ReleaseGateCatalog) {
  return Object.keys(RELEASE_GATE_STATUS_TO_PERSISTED).every(
    (status) =>
      catalog.summary.statusCounts[status as ReleaseGateStatus] ===
      catalog.checks.filter((check) => check.status === status).length,
  );
}
