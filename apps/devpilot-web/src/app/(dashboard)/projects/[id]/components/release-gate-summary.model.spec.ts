import { describe, expect, it } from 'vitest';
import { getStatusTone } from '@/components/ui/status-map';
import type {
  ReleaseGateCheck,
  ReleaseGatePersistedStatus,
  ReleaseGateStatus,
} from '../types/release-gate.types';
import { releaseGateCatalogFixture } from './release-gate-catalog.spec-fixtures';
import { buildReleaseGateSummary, releaseGateStatusTone } from './release-gate-summary.model';

describe('release gate summary model', () => {
  it('accepts the exact 15/51 catalog and excludes target-only C04 from Build readiness', () => {
    const catalog = releaseGateCatalogFixture();
    setStatus(catalog.checks.find((check) => check.id === 'C04')!, 'blocked');
    setStatus(catalog.checks.find((check) => check.id === 'C06')!, 'warning');
    catalog.decisions.build.warningGateIds = ['C06'];
    syncStatusCounts(catalog);

    const summary = buildReleaseGateSummary(catalog);

    expect(summary).toMatchObject({
      valid: true,
      canEnterBuild: true,
      blockingCount: 0,
      capabilityCount: 15,
      totalChecks: 51,
    });
    expect(summary.previews.map((preview) => preview.key)).toEqual([
      'source',
      'impact',
      'security',
      'baseline',
    ]);
  });

  it.each<ReleaseGateStatus>(['unchecked', 'blocked', 'manual', 'unavailable'])(
    'fails the informational Build conclusion closed for %s MVP Commit evidence',
    (status) => {
      const catalog = releaseGateCatalogFixture();
      setStatus(catalog.checks.find((check) => check.id === 'C01')!, status);
      catalog.decisions.build.allowed = false;
      if (status === 'manual') catalog.decisions.build.manualGateIds = ['C01'];
      else catalog.decisions.build.blockerGateIds = ['C01'];
      syncStatusCounts(catalog);
      expect(buildReleaseGateSummary(catalog)).toMatchObject({
        valid: true,
        canEnterBuild: false,
        blockingCount: 1,
      });
    },
  );

  it('uses the persisted server verdict and rejects a decision/check mismatch', () => {
    const denied = releaseGateCatalogFixture();
    denied.decisions.build.allowed = false;
    denied.decisions.build.blockerGateIds = ['C01'];
    expect(buildReleaseGateSummary(denied)).toMatchObject({
      valid: false,
      canEnterBuild: false,
    });

    setStatus(denied.checks.find((check) => check.id === 'C01')!, 'blocked');
    syncStatusCounts(denied);
    expect(buildReleaseGateSummary(denied)).toMatchObject({
      valid: true,
      canEnterBuild: false,
      blockingCount: 1,
    });
  });

  it('fails closed when Build attempts a Production-only deferral', () => {
    const catalog = releaseGateCatalogFixture();
    catalog.decisions.build.deferredGateIds = ['C01'];
    expect(buildReleaseGateSummary(catalog)).toMatchObject({
      valid: false,
      canEnterBuild: false,
    });
  });

  it('fails closed when 15/51 ownership or phase facts drift', () => {
    const missingCapability = releaseGateCatalogFixture();
    missingCapability.capabilities.pop();
    expect(buildReleaseGateSummary(missingCapability)).toMatchObject({
      valid: false,
      canEnterBuild: false,
    });

    const duplicateCheck = releaseGateCatalogFixture();
    duplicateCheck.checks[50] = { ...duplicateCheck.checks[49] };
    expect(buildReleaseGateSummary(duplicateCheck)).toMatchObject({
      valid: false,
      canEnterBuild: false,
    });
  });

  it('rejects foreign ownership and drift between evaluated and persisted semantics', () => {
    const foreignOwner = releaseGateCatalogFixture();
    foreignOwner.checks.find((check) => check.id === 'C01')!.capabilityId = 'M15';
    expect(buildReleaseGateSummary(foreignOwner).valid).toBe(false);

    const driftedStatus = releaseGateCatalogFixture();
    driftedStatus.checks[0].persistedStatus = 'failed';
    expect(buildReleaseGateSummary(driftedStatus).valid).toBe(false);
  });

  it('gives every unified status a distinct semantic tone', () => {
    const statuses: ReleaseGateStatus[] = [
      'checked',
      'unchecked',
      'blocked',
      'warning',
      'manual',
      'unavailable',
    ];
    const renderedTones = statuses.map((status) => getStatusTone(releaseGateStatusTone(status)));
    expect(new Set(renderedTones).size).toBe(statuses.length);
  });
});

function setStatus(check: ReleaseGateCheck, status: ReleaseGateStatus) {
  const persisted: Record<ReleaseGateStatus, ReleaseGatePersistedStatus> = {
    checked: 'passed',
    unchecked: 'pending',
    blocked: 'failed',
    warning: 'warning',
    manual: 'needs_human',
    unavailable: 'unavailable',
  };
  check.status = status;
  check.persistedStatus = persisted[status];
  check.reasonCode = status;
}

function syncStatusCounts(catalog: ReturnType<typeof releaseGateCatalogFixture>) {
  for (const status of Object.keys(catalog.summary.statusCounts) as ReleaseGateStatus[]) {
    catalog.summary.statusCounts[status] = catalog.checks.filter(
      (check) => check.status === status,
    ).length;
  }
}
