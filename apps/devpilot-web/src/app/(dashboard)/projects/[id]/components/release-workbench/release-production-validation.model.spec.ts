import { describe, expect, it } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import { releaseProductionValidationChecks } from './release-production-validation.model';

describe('releaseProductionValidationChecks', () => {
  it('binds validation to the latest production deployment and frozen manifest', () => {
    const checks = releaseProductionValidationChecks([run()], currentVersion());
    expect(checks.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: 'artifactIntegrity', label: 'passed' },
      { key: 'environmentVersion', label: 'passed' },
      { key: 'workloadReady', label: 'passed' },
      { key: 'healthProbe', label: 'passed' },
      { key: 'entryProbe', label: 'passed' },
      { key: 'routeSwitch', label: 'passed' },
    ]);
    expect(checks.every((check) => check.tone === 'success')).toBe(true);
    expect(checks.map((check) => check.checkedAt)).toEqual([
      null,
      '2026-08-27T10:03:00Z',
      '2026-08-27T10:01:10Z',
      '2026-08-27T10:01:20Z',
      '2026-08-27T10:01:40Z',
      '2026-08-27T10:01:50Z',
    ]);
  });

  it('does not invent production validation when there is no run', () => {
    expect(
      releaseProductionValidationChecks([]).every((check) => check.label === 'unavailable'),
    ).toBe(true);
  });

  it('fails exact digest, online version, health and route mismatches without finish-time fallback', () => {
    const value = run() as ReleaseEvidenceProductionRun;
    value.deploymentRuns[0].manifest.digest = 'sha256:other';
    (
      value.deploymentRuns[0].result as { healthProbe: { status: string; checkedAt?: string } }
    ).healthProbe = { status: 'failed' };
    value.deploymentRuns[0].siteProbe!.tls.status = null;
    value.deploymentRuns[0].routeSwitch!.releaseRunId = 'release-other';
    const checks = releaseProductionValidationChecks(
      [value],
      currentVersion({ artifactManifestId: 'manifest-other' }),
    );
    expect(checks.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: 'artifactIntegrity', label: 'failed' },
      { key: 'environmentVersion', label: 'failed' },
      { key: 'workloadReady', label: 'passed' },
      { key: 'healthProbe', label: 'failed' },
      { key: 'entryProbe', label: 'unavailable' },
      { key: 'routeSwitch', label: 'failed' },
    ]);
    expect(checks.find((check) => check.key === 'healthProbe')?.checkedAt).toBeNull();
  });
});

function run() {
  return {
    id: 'release-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'production-env',
    artifactManifestId: 'manifest-1',
    createdAt: '2026-08-27T10:00:00Z',
    finishedAt: '2026-08-27T10:02:00Z',
    verifiedDigest: 'sha256:manifest',
    manifest: { id: 'manifest-1', digest: 'sha256:manifest' },
    deploymentRuns: [
      {
        id: 'deployment-1',
        projectId: 'project-1',
        releaseOrderId: 'order-1',
        releaseRunId: 'release-1',
        environmentId: 'production-env',
        artifactManifestId: 'manifest-1',
        source: 'release_order',
        targetType: 'project_environment',
        dryRun: false,
        status: 'completed',
        createdAt: '2026-08-27T10:01:00Z',
        finishedAt: '2026-08-27T10:02:00Z',
        result: {
          workloadReady: { status: 'passed', checkedAt: '2026-08-27T10:01:10Z' },
          healthProbe: { status: 'succeeded', checkedAt: '2026-08-27T10:01:20Z' },
        },
        manifest: { id: 'manifest-1', digest: 'sha256:manifest' },
        siteProbe: {
          probedAt: '2026-08-27T10:01:40Z',
          dns: { status: 'resolved', checkedAt: '2026-08-27T10:01:30Z' },
          tls: { status: 'not_required', checkedAt: '2026-08-27T10:01:35Z' },
          http: { status: 'passed', checkedAt: '2026-08-27T10:01:40Z' },
        },
        routeSwitch: {
          status: 'switched',
          deploymentRunId: 'deployment-1',
          releaseRunId: 'release-1',
          switchedAt: '2026-08-27T10:01:50Z',
        },
      },
    ],
  } as ReleaseEvidenceProductionRun;
}

function currentVersion(
  overrides: Partial<NonNullable<ProjectDeliverySummary['currentVersions']['production']>> = {},
) {
  return {
    id: 'version-1',
    releaseOrderId: 'order-1',
    releaseVersion: '1.0.0',
    artifactManifestId: 'manifest-1',
    manifestDigest: 'sha256:manifest',
    deploymentRunId: 'deployment-1',
    effectiveAt: '2026-08-27T10:03:00Z',
    ...overrides,
  };
}
