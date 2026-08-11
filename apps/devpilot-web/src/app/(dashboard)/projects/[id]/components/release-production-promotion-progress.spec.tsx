import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import { ReleaseProductionPromotionProgress } from './release-production-promotion-progress';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('ReleaseProductionPromotionProgress', () => {
  it('shows candidate, manual validation and promote observation in order', () => {
    const html = renderToStaticMarkup(
      <ReleaseProductionPromotionProgress run={run('awaiting_validation', 'awaiting_validation')} />,
    );
    expect(html.indexOf('releaseProductionProgressCandidate')).toBeLessThan(
      html.indexOf('releaseProductionProgressManual'),
    );
    expect(html.indexOf('releaseProductionProgressManual')).toBeLessThan(
      html.indexOf('releaseProductionProgressPromote'),
    );
    expect(html).toContain('releaseProductionProgressStatus_done');
    expect(html).toContain('releaseProductionProgressStatus_current');
    expect(html).toContain('releaseProductionProgressStatus_waiting');
  });

  it('marks all three server-owned phases complete only after release success', () => {
    const html = renderToStaticMarkup(
      <ReleaseProductionPromotionProgress run={run('succeeded', 'completed')} />,
    );
    expect(html.match(/releaseProductionProgressStatus_done/g)).toHaveLength(3);
  });

  it('marks promotion progress blocked for blocked runs and legacy recovery', () => {
    const blocked = run('blocked', 'awaiting_validation');
    expect(renderToStaticMarkup(<ReleaseProductionPromotionProgress run={blocked} />))
      .toContain('releaseProductionProgressStatus_blocked');
    const legacy = run('succeeded', 'completed');
    legacy.legacyPromotionRecovery = { status: 'required', commandIds: ['command-1'],
      phase: 'legacy_reconcile_required', reason: 'unknown',
      reasonCode: 'legacy_promotion_reconciliation_required' };
    expect(renderToStaticMarkup(<ReleaseProductionPromotionProgress run={legacy} />))
      .toContain('releaseProductionProgressStatus_blocked');
  });
});

function run(releaseStatus: string, deploymentStatus: string) {
  return {
    environmentId: 'production-1',
    artifactManifestId: 'manifest-1',
    status: releaseStatus,
    deploymentRuns: [{
      environmentId: 'production-1',
      artifactManifestId: 'manifest-1',
      status: deploymentStatus,
    }],
  } as ReleaseEvidenceProductionRun;
}
