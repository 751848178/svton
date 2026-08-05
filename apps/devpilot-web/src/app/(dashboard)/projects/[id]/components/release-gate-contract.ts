import type {
  ReleaseGatePhase,
  ReleaseGatePersistedStatus,
  ReleaseGateStatus,
} from '../types/release-gate.types';

export const RELEASE_GATE_EXPECTED_PHASE_COUNTS: Record<ReleaseGatePhase, number> = {
  commit: 10,
  build: 11,
  deploy: 20,
  promote: 10,
};

export const RELEASE_GATE_EXPECTED_CAPABILITIES = Array.from(
  { length: 15 },
  (_, index) => `M${String(index + 1).padStart(2, '0')}`,
);

const CAPABILITY_MEMBERS: Record<string, string[]> = {
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

export const RELEASE_GATE_EXPECTED_OWNERS = new Map(
  Object.entries(CAPABILITY_MEMBERS).flatMap(([capabilityId, ids]) =>
    ids.map((id) => [id, capabilityId]),
  ),
);

export const RELEASE_GATE_STATUS_TO_PERSISTED: Record<
  ReleaseGateStatus,
  ReleaseGatePersistedStatus
> = {
  checked: 'passed',
  unchecked: 'pending',
  blocked: 'failed',
  warning: 'warning',
  manual: 'needs_human',
  unavailable: 'unavailable',
};

export const RELEASE_GATE_EXPECTED_COMMIT_MVP = [
  'C01',
  'C02',
  'C03',
  'C05',
  'C06',
  'C07',
  'C08',
  'C09',
  'C10',
];
