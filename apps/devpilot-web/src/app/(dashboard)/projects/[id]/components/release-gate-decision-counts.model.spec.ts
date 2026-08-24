import { describe, expect, it } from 'vitest';
import type { ReleaseGateDecision } from '../types/release-gate.types';
import { buildReleaseGateDecisionCounts } from './release-gate-decision-counts.model';
import { releaseGateCatalogFixture } from './release-gate-catalog.spec-fixtures';
import { buildReleaseGateSummary } from './release-gate-summary.model';
import { buildReleaseWorkbenchGateSummary } from './release-workbench/release-workbench-summary.model';

describe('release gate decision counts single source (ROD-1)', () => {
  it('counts hard blockers plus integrity errors, pending manual separately', () => {
    const value: ReleaseGateDecision = makeDecision({
      blockerGateIds: ['G1', 'G2'],
      manualGateIds: ['M1', 'M2'],
      confirmedManualGateIds: ['M1'],
      warningGateIds: ['W1'],
      integrityErrors: ['catalog-drift'],
    });

    expect(buildReleaseGateDecisionCounts(value)).toEqual({
      blocked: 3,
      warning: 1,
      manual: 1,
    });
  });

  it('treats missing decisions and stray confirmed ids as zero-count noise', () => {
    expect(buildReleaseGateDecisionCounts(null)).toEqual({ blocked: 0, warning: 0, manual: 0 });
    expect(buildReleaseGateDecisionCounts(undefined)).toEqual({
      blocked: 0,
      warning: 0,
      manual: 0,
    });
    expect(
      buildReleaseGateDecisionCounts(
        makeDecision({ manualGateIds: [], confirmedManualGateIds: ['ghost'] }),
      ).manual,
    ).toBe(0);
  });

  it('derives one identical blocking number for decision card, advanced checks and evidence tab', () => {
    const catalog = releaseGateCatalogFixture();
    catalog.decisions.build.allowed = false;
    // 决策卡计数来源：blocker 1 + manual 2（未确认）+ warning 1。
    catalog.decisions.build.blockerGateIds = ['C01'];
    catalog.decisions.build.manualGateIds = ['C02', 'C03'];
    catalog.decisions.build.confirmedManualGateIds = [];
    catalog.decisions.build.warningGateIds = ['C05'];
    setCheckStatus(catalog, 'C01', 'blocked');
    setCheckStatus(catalog, 'C02', 'manual');
    setCheckStatus(catalog, 'C03', 'manual');
    setCheckStatus(catalog, 'C05', 'warning');
    syncStatusCounts(catalog);

    const workbench = buildReleaseWorkbenchGateSummary({
      step: 'build',
      catalog,
      loading: false,
      error: '',
      locale: 'zh',
    });
    const gateSummary = buildReleaseGateSummary(catalog);
    const evidenceBlocked = buildReleaseGateDecisionCounts(catalog.decisions.build).blocked;

    expect(gateSummary.valid).toBe(true);
    expect(evidenceBlocked).toBe(1);
    expect(workbench.blockerCount).toBe(evidenceBlocked);
    expect(gateSummary.blockingCount).toBe(evidenceBlocked);
    expect(workbench.manualCount).toBe(gateSummary.manualCount);
    expect(workbench.manualCount).toBe(2);
  });
});

function setCheckStatus(
  catalog: ReturnType<typeof releaseGateCatalogFixture>,
  checkId: string,
  status: 'blocked' | 'manual' | 'warning',
) {
  const check = catalog.checks.find((item) => item.id === checkId)!;
  check.status = status;
  check.persistedStatus =
    status === 'blocked' ? 'failed' : status === 'manual' ? 'needs_human' : 'warning';
  check.reasonCode = status;
}

function syncStatusCounts(catalog: ReturnType<typeof releaseGateCatalogFixture>) {
  for (const status of Object.keys(catalog.summary.statusCounts)) {
    catalog.summary.statusCounts[status as keyof typeof catalog.summary.statusCounts] =
      catalog.checks.filter((check) => check.status === status).length;
  }
}

function makeDecision(patch: Partial<ReleaseGateDecision>): ReleaseGateDecision {
  return {
    id: 'decision-1',
    stage: 'build',
    phase: 'commit',
    allowed: false,
    blockerGateIds: [],
    manualGateIds: [],
    confirmedManualGateIds: [],
    warningGateIds: [],
    deferredGateIds: [],
    evidenceOnlyGateIds: [],
    integrityErrors: [],
    inputHash: 'hash',
    decidedAt: '2026-08-22T00:00:00.000Z',
    ...patch,
  };
}
