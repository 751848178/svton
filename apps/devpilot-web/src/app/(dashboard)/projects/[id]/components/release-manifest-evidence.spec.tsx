import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseManifestEvidence } from './release-manifest-evidence';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('ReleaseManifestEvidence', () => {
  it('keeps component evidence nested under its exact Manifest', () => {
    const html = renderToStaticMarkup(
      <ReleaseManifestEvidence
        manifest={{
          id: 'manifest-1',
          digest: 'sha256:manifest',
          items: [
            {
              componentKey: 'project-bundle',
              artifactType: 'zip',
              uri: 'release-artifact://build-1/bundle.zip',
              digest: 'sha256:item',
              metadata: null,
            },
          ],
        }}
      />,
    );
    expect(html).toContain('releaseManifestEvidenceTitle');
    expect(html).toContain('project-bundle · zip');
    expect(html).toContain('release-artifact://build-1/bundle.zip');
    expect(html).toContain('sha256:item');
  });
});
