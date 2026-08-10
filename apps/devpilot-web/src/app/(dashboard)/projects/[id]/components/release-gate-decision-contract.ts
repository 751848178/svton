import type {
  ReleaseGateCatalog,
  ReleaseGateCheck,
  ReleaseGateDecision,
} from '../types/release-gate.types';
import { RELEASE_GATE_EXPECTED_COMMIT_MVP } from './release-gate-contract';

export function hasExactBuildDecision(catalog: ReleaseGateCatalog) {
  const decision = catalog.decisions?.build;
  if (!decision || decision.stage !== 'build' || decision.phase !== 'commit') return false;
  const allowedIds = new Set(RELEASE_GATE_EXPECTED_COMMIT_MVP);
  const lists = [
    decision.blockerGateIds,
    decision.manualGateIds,
    decision.confirmedManualGateIds,
    decision.warningGateIds,
    decision.deferredGateIds,
  ];
  if (
    !decision.id ||
    !decision.inputHash ||
    !decision.decidedAt ||
    decision.deferredGateIds.length > 0 ||
    lists.some((ids) => ids.some((id) => !allowedIds.has(id))) ||
    hasDuplicates(lists.flat()) ||
    decision.allowed !==
      (decision.blockerGateIds.length === 0 &&
        decision.manualGateIds.length === 0 &&
        decision.integrityErrors.length === 0)
  ) {
    return false;
  }
  return RELEASE_GATE_EXPECTED_COMMIT_MVP.every((id) => {
    const check = catalog.checks.find((candidate) => candidate.id === id);
    return check ? matchesDecision(check, decision) : false;
  });
}

function matchesDecision(check: ReleaseGateCheck, decision: ReleaseGateDecision) {
  const lists = {
    blocker: decision.blockerGateIds.includes(check.id),
    manual: decision.manualGateIds.includes(check.id),
    confirmed: decision.confirmedManualGateIds.includes(check.id),
    warning: decision.warningGateIds.includes(check.id),
  };
  if (!check.providerKey || check.fresh === false) return lists.blocker;
  if (check.status === 'checked') return !Object.values(lists).some(Boolean);
  if (check.status === 'warning') return lists.warning;
  if (check.status === 'manual') return lists.manual !== lists.confirmed;
  return lists.blocker;
}

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length;
}
