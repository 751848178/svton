import { describe, expect, it } from 'vitest';
import type { ReleaseGateCatalog } from '../../types/release-gate.types';
import type { ReleaseOrderEvidence } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import {
  buildReleaseWorkbenchGateSummary,
  latestReleaseManifest,
  releaseWorkbenchDecisionStep,
} from './release-workbench-summary.model';

describe('release workbench summary model', () => {
  it('uses the selected stage gate decision and localized blocker evidence', () => {
    const result = buildReleaseWorkbenchGateSummary({
      step: 'production',
      catalog: catalog(),
      loading: false,
      error: '',
      locale: 'zh-CN',
    });

    expect(result).toMatchObject({
      stage: 'production',
      state: 'blocked',
      blockerCount: 1,
      warningCount: 1,
      manualCount: 1,
      reason: '生产环境缺少活动服务',
    });
  });

  it('fails closed while the gate decision is unavailable', () => {
    expect(
      buildReleaseWorkbenchGateSummary({
        step: 'build',
        catalog: null,
        loading: false,
        error: 'scope mismatch',
        locale: 'en',
      }),
    ).toMatchObject({ state: 'error', reason: 'scope mismatch' });
  });

  it('fails closed when the selected stage decision is absent at runtime', () => {
    const input = catalog() as unknown as { decisions: { production: null } };
    input.decisions.production = null;

    expect(
      buildReleaseWorkbenchGateSummary({
        step: 'production',
        catalog: input as unknown as ReleaseGateCatalog,
        loading: false,
        error: '',
        locale: 'zh',
      }),
    ).toMatchObject({ stage: 'production', state: 'error', blockerCount: 0 });
  });

  it('selects the newest real manifest instead of the newest failed build', () => {
    const result = latestReleaseManifest({
      buildRuns: {
        total: 3,
        hasMore: false,
        items: [
          { createdAt: '2026-08-19T03:00:00.000Z', manifest: null },
          { createdAt: '2026-08-19T02:00:00.000Z', manifest: { id: 'manifest-new' } },
          { createdAt: '2026-08-19T01:00:00.000Z', manifest: { id: 'manifest-old' } },
        ],
      },
    } as unknown as ReleaseOrderEvidence);

    expect(result?.id).toBe('manifest-new');
  });

  it('keeps a Production-frozen manifest ahead of a later successful build manifest', () => {
    const result = latestReleaseManifest({
      productionReleaseRuns: {
        items: [
          {
            createdAt: '2026-08-19T02:00:00.000Z',
            manifest: { id: 'manifest-frozen' },
          },
        ],
      },
      buildRuns: {
        items: [
          {
            createdAt: '2026-08-19T03:00:00.000Z',
            manifest: { id: 'manifest-later-build' },
          },
        ],
      },
    } as unknown as ReleaseOrderEvidence);

    expect(result?.id).toBe('manifest-frozen');
  });

  it('anchors the decision to the latest failure without moving the execution position', () => {
    expect(
      releaseWorkbenchDecisionStep({
        resumeStep: 'staging',
        lifecycle: { phase: 'build', failureKind: 'blocked' },
      } as ReleaseOrderDetail),
    ).toBe('build');
    expect(
      releaseWorkbenchDecisionStep({
        resumeStep: 'staging',
        lifecycle: { phase: 'build', failureKind: undefined },
      } as ReleaseOrderDetail),
    ).toBe('staging');
  });
});

function catalog() {
  return {
    decisions: {
      production: {
        allowed: false,
        blockerGateIds: ['production-services'],
        integrityErrors: [],
        warningGateIds: ['warning'],
        manualGateIds: ['manual'],
        confirmedManualGateIds: [],
      },
      build: {},
      staging: {},
    },
    checks: [
      {
        id: 'production-services',
        reason: { zh: '生产环境缺少活动服务', en: 'Production has no active service' },
      },
    ],
  } as unknown as ReleaseGateCatalog;
}
