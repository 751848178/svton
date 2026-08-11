import { describe, expect, it } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import { releaseProductionCurrentRun } from './release-production-current-run.model';

describe('releaseProductionCurrentRun', () => {
  it('resumes only the exact order, environment, deployment and candidate hash', () => {
    const state = releaseProductionCurrentRun(
      [run()],
      'release-1',
      'order-1',
    );

    expect(state.awaitingResume).toEqual({
      environmentId: 'production-1',
      input: {
        releaseRunId: 'release-1',
        deploymentRunId: 'deployment-1',
        candidateHash: 'a'.repeat(64),
      },
    });
  });

  it.each([
    ['wrong order', { releaseOrderId: 'other-order' }],
    ['wrong manifest', { manifestId: 'other-manifest' }],
    ['wrong environment', { environmentId: 'other-environment' }],
    ['invalid hash', { candidateHash: 'not-a-hash' }],
  ])('fails closed for %s', (_label, drift) => {
    const fixture = run();
    Object.assign(fixture.deploymentRuns[0], {
      environmentId: drift.environmentId ?? fixture.environmentId,
    });
    Object.assign(
      (fixture.deploymentRuns[0].result as Record<string, Record<string, string>>)
        .productionCandidate,
      drift,
    );

    expect(releaseProductionCurrentRun([fixture], undefined, 'order-1').awaitingResume).toBeNull();
  });

  it('never resumes a legacy command until server reconciliation completes', () => {
    const fixture = run();
    fixture.legacyPromotionRecovery = {
      id: 'legacy-command', phase: 'legacy_reconcile_required',
      legacyReconcileRequired: true,
      legacyReconcileReason: 'pre_lease_phase_unverifiable',
      createdAt: '2026-08-11T00:00:00Z',
    };
    const state = releaseProductionCurrentRun([fixture], undefined, 'order-1');
    expect(state.awaitingResume).toBeNull();
    expect(state.legacyRecovery).toEqual(fixture.legacyPromotionRecovery);
  });
});

function run(): ReleaseEvidenceProductionRun {
  return {
    id: 'release-1', projectId: 'project-1', releaseOrderId: 'order-1',
    environmentId: 'production-1', artifactManifestId: 'manifest-1', mode: 'upgrade',
    status: 'awaiting_validation', verifiedDigest: 'sha256:exact', errorCode: null,
    errorMessage: null, startedAt: null, finishedAt: null, createdAt: '2026-08-11T00:00:00Z',
    environment: { id: 'production-1', name: 'Production', baselineRole: 'production' },
    manifest: {} as ReleaseEvidenceProductionRun['manifest'],
    operationApproval: { status: 'approved' } as ReleaseEvidenceProductionRun['operationApproval'],
    legacyPromotionRecovery: null,
    stagingProof: null,
    deploymentRuns: [{
      id: 'deployment-1', environmentId: 'production-1', status: 'awaiting_validation',
      result: { productionCandidate: {
        candidateHash: 'a'.repeat(64), releaseOrderId: 'order-1', manifestId: 'manifest-1',
      } },
    } as ReleaseEvidenceProductionRun['deploymentRuns'][number]],
  };
}
