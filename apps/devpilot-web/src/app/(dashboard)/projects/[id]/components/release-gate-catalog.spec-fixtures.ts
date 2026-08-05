import type {
  ReleaseGateCatalog,
  ReleaseGateCheck,
  ReleaseGatePhase,
  ReleaseGateStatus,
} from '../types/release-gate.types';

const PHASE_COUNTS: Record<ReleaseGatePhase, number> = {
  commit: 10,
  build: 11,
  deploy: 20,
  promote: 10,
};

export function releaseGateCatalogFixture(): ReleaseGateCatalog {
  const phases = Object.entries(PHASE_COUNTS).flatMap(([phase, count]) =>
    Array.from({ length: count }, (_, index) => ({ phase: phase as ReleaseGatePhase, index })),
  );
  const checks = phases.map(({ phase, index }) => makeCheck(phase, index));
  return {
    catalogVersion: 'v13.test',
    capabilityVersion: 'mvp15.test',
    releaseOrder: { id: 'order-1', releaseVersion: '2.4.1' },
    summary: { total: 51, phaseCounts: PHASE_COUNTS, statusCounts: statusCounts() },
    capabilities: Array.from({ length: 15 }, (_, index) => ({
      id: `M${String(index + 1).padStart(2, '0')}`,
      name: { zh: `能力 ${index + 1}`, en: `Capability ${index + 1}` },
      available: true,
      providerKey: 'fixture-provider',
      reasonCode: 'fixture',
      reason: { zh: 'fixture', en: 'fixture' },
    })),
    checks,
  };
}

function makeCheck(phase: ReleaseGatePhase, index: number): ReleaseGateCheck {
  const prefix = { commit: 'C', build: 'B', deploy: 'D', promote: 'P' }[phase];
  const id = `${prefix}${String(index + 1).padStart(2, '0')}`;
  const capabilityId = capabilityFor(id);
  return {
    id,
    phase,
    ordinal: index + 1,
    title: { zh: id, en: id },
    dispositions: ['block'],
    capabilityId,
    delivery: capabilityId ? 'mvp' : 'target',
    status: 'checked',
    providerKey: capabilityId ? 'fixture-provider' : null,
    reasonCode: 'fixture',
    reason: { zh: 'fixture', en: 'fixture' },
    evidenceRef: null,
    checkedAt: null,
    expiresAt: null,
    fresh: true,
    evaluationId: `evaluation-${id}`,
    definitionVersion: 'v13.test:mvp15.test',
    persistedStatus: 'passed',
    persistedAt: '2026-08-05T00:00:00.000Z',
  };
}

function capabilityFor(id: string): ReleaseGateCheck['capabilityId'] {
  const members: Record<string, string[]> = {
    M01: ['C01', 'C02', 'C03'],
    M02: ['C05', 'C06'],
    M03: ['C08', 'C09', 'B01', 'B02', 'B03'],
    M04: ['C07', 'C10', 'B06'],
    M05: ['B09'],
    M06: ['D02', 'D03'],
    M07: ['D01', 'D07', 'D08', 'D09'],
    M08: ['D05'],
    M09: ['D10', 'D11', 'D12'],
    M10: ['D13'],
    M11: ['D14', 'D15', 'D16'],
    M12: ['D17', 'P01', 'P02', 'P03'],
    M13: ['D18', 'P04'],
    M14: ['D19', 'D20', 'P10'],
    M15: ['D06', 'P08'],
  };
  return Object.entries(members).find(([, ids]) => ids.includes(id))?.[0] ?? null;
}

function statusCounts(): Record<ReleaseGateStatus, number> {
  return { checked: 51, unchecked: 0, blocked: 0, warning: 0, manual: 0, unavailable: 0 };
}
