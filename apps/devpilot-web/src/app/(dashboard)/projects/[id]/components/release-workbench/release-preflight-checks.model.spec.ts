import { describe, expect, it } from 'vitest';
import type {
  ReleaseGateCatalog,
  ReleaseGateCheck,
  ReleaseGateDecision,
} from '../../types/release-gate.types';
import { releasePreflightCheckRows } from './release-preflight-checks.model';

describe('releasePreflightCheckRows', () => {
  it('uses only gate ids evaluated by the exact current decision', () => {
    const catalog = fixture();
    catalog.decisions.staging.evaluations = [
      { ...evaluation('B02'), providerKey: 'decision-provider' },
      evaluation('B01'),
    ];

    const rows = releasePreflightCheckRows(catalog, 'staging');
    expect(rows.map((row) => [row.check.id, row.impact])).toEqual([
      ['B01', 'blocker'],
      ['B02', 'nonBlocking'],
    ]);
    expect(rows[1].check.providerKey).toBe('decision-provider');
  });

  it('falls back to the decision phase only when evaluations are absent', () => {
    const catalog = fixture();

    expect(releasePreflightCheckRows(catalog, 'staging').map((row) => row.check.id)).toEqual([
      'B01',
      'B02',
    ]);
  });

  it('does not substitute another stage or phase when the exact decision has no evaluations', () => {
    const catalog = fixture();
    catalog.decisions.staging.evaluations = [];

    expect(releasePreflightCheckRows(catalog, 'staging')).toEqual([]);
  });
});

function fixture(): ReleaseGateCatalog {
  const staging = decision();
  return {
    catalogVersion: 'v13.test',
    capabilityVersion: 'mvp15.test',
    releaseOrder: { id: 'order-1', releaseVersion: '1.0.0' },
    summary: {
      total: 3,
      phaseCounts: { commit: 1, build: 2, deploy: 0, promote: 0 },
      statusCounts: {
        checked: 2,
        unchecked: 0,
        blocked: 0,
        warning: 0,
        manual: 0,
        unavailable: 1,
      },
    },
    decisions: {
      build: decision('build', 'commit'),
      staging,
      production: decision('production', 'deploy'),
    },
    targetReadiness: {} as ReleaseGateCatalog['targetReadiness'],
    capabilities: [],
    checks: [check('B01', 'build', 1), check('B02', 'build', 2), check('C01', 'commit', 3)],
  };
}

function decision(
  stage: ReleaseGateDecision['stage'] = 'staging',
  phase: ReleaseGateDecision['phase'] = 'build',
): ReleaseGateDecision {
  return {
    id: `decision-${stage}`,
    stage,
    phase,
    allowed: false,
    blockerGateIds: stage === 'staging' ? ['B01'] : [],
    manualGateIds: [],
    confirmedManualGateIds: [],
    warningGateIds: [],
    deferredGateIds: [],
    evidenceOnlyGateIds: [],
    integrityErrors: [],
    inputHash: 'input-hash',
    decidedAt: '2026-08-28T00:00:00.000Z',
  };
}

function check(id: string, phase: ReleaseGateCheck['phase'], ordinal: number): ReleaseGateCheck {
  return {
    id,
    phase,
    ordinal,
    title: { zh: id, en: id },
    dispositions: [],
    capabilityId: null,
    delivery: 'mvp',
    status: id === 'B01' ? 'unavailable' : 'checked',
    providerKey: 'provider',
    reasonCode: 'TEST',
    reason: { zh: '原因', en: 'Reason' },
    evidenceRef: `evidence-${id}`,
    checkedAt: '2026-08-28T00:00:00.000Z',
    expiresAt: null,
    fresh: true,
    evaluationId: `evaluation-${id}`,
    evaluationInputHash: `hash-${id}`,
    definitionVersion: 'v1',
    persistedStatus: 'passed',
    persistedAt: '2026-08-28T00:00:00.000Z',
    waiver: null,
    waiverExpiresAt: null,
  };
}

function evaluation(gateId: string) {
  const item = check(gateId, 'build', 1);
  return {
    gateId,
    evaluationId: item.evaluationId,
    evaluationInputHash: item.evaluationInputHash,
    status: item.status,
    providerKey: item.providerKey,
    reasonCode: item.reasonCode,
    reason: item.reason,
    evidenceRef: item.evidenceRef,
    checkedAt: item.checkedAt,
    expiresAt: item.expiresAt,
    fresh: item.fresh,
    waiver: item.waiver,
    waiverExpiresAt: item.waiverExpiresAt,
    manualApprovals: [],
  };
}
