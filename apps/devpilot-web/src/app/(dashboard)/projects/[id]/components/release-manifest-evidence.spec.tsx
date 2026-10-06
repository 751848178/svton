import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseManifestEvidence, ReleaseManifestRawEvidence } from './release-manifest-evidence';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const componentKey = 'cmrwxm1tl000y6enjwoz2k2jq';

function manifest() {
  return {
    id: 'manifest-1',
    digest: 'sha256:manifest',
    items: [
      {
        componentKey,
        artifactType: 'zip',
        uri: 'release-artifact://build-1/backend.zip',
        digest: `sha256:${'c'.repeat(64)}`,
        metadata: { sizeBytes: 1048576 },
      },
      {
        componentKey: 'project-bundle',
        artifactType: 'zip',
        uri: 'release-artifact://build-1/bundle.zip',
        digest: 'sha256:item',
        metadata: null,
      },
    ],
  };
}

describe('ReleaseManifestEvidence', () => {
  it('renders a readable artifact list with resolved names, sizes, and short digests', () => {
    const html = renderToStaticMarkup(
      <ReleaseManifestEvidence
        manifest={manifest()}
        componentNames={{ [componentKey]: '后端服务' }}
      />,
    );
    expect(html).toContain('releaseManifestArtifactList');
    // 组件 cuid 翻译为人读名称；合成键原样展示。
    expect(html).toContain('后端服务');
    expect(html).toContain('project-bundle');
    expect(html).toContain('zip');
    // 大小来自 manifest metadata.sizeBytes（PX-32 字节人性化）。
    expect(html).toContain('1.0MB（1048576 字节）');
    // digest 短哈希 + title 全文；内部 URI 不进人读层。
    expect(html).toContain(`sha256:${'c'.repeat(12)}…`);
    expect(html).toContain(`title="sha256:${'c'.repeat(64)}"`);
    expect(html).not.toContain('release-artifact://build-1/backend.zip');
  });

  it('keeps full digests and internal uris in the raw evidence block', () => {
    const html = renderToStaticMarkup(<ReleaseManifestRawEvidence manifest={manifest()} />);
    expect(html).toContain(componentKey);
    expect(html).toContain(`sha256:${'c'.repeat(64)}`);
    expect(html).toContain('release-artifact://build-1/backend.zip');
    expect(html).toContain('release-artifact://build-1/bundle.zip');
  });
});
