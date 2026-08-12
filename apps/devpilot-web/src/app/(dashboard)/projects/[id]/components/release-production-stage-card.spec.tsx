// @vitest-environment jsdom

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  productionStageCopy,
  ReleaseProductionStageCard,
} from './release-production-stage-card';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('ReleaseProductionStageCard acceptance truth', () => {
  it('shows technical acceptance without claiming the release is online', () => {
    const html = renderToStaticMarkup(<ReleaseProductionStageCard
      currentOnline=""
      technicalAcceptance
      technicalDigest="sha256:technical"
      releaseVersion="v1"
      pendingApprovals={0}
      online={false}
      titleKey="releaseStageCalloutTechnicalAcceptance"
      descriptionKey="releaseStageCalloutTechnicalAcceptanceDetail"
      primaryAction={null}
      manifestId=""
      candidates={[]}
      selectDisabled
      onManifestChange={() => undefined}
      frozenManifest="sha256:technical"
      preflightReady
      acceptanceOnly
      dialog={null}
    />);
    expect(html).toContain('releaseContextTechnicalAcceptance');
    expect(html).toContain('releaseStageSummaryTechnicalAcceptance');
    expect(html).not.toContain('releaseContextRunningNormally');
  });

  it('uses technical-only terminal copy instead of online healthy copy', () => {
    const run = {
      status: 'succeeded', operationApproval: { status: 'approved' },
    } as never;
    expect(productionStageCopy(run, false, 'technical_acceptance')).toEqual({
      titleKey: 'releaseStageCalloutTechnicalAcceptance',
      descriptionKey: 'releaseStageCalloutTechnicalAcceptanceDetail',
    });
  });
});
