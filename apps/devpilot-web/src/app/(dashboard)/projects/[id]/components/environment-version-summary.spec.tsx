import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVersionItem } from '../types/environment-version.types';
import { formatIso } from '../utils/release-time.utils';
import { EnvironmentVersionSummary } from './environment-version-summary';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe('EnvironmentVersionSummary Demo-aligned facts', () => {
  it('renders the four facts: deployed version, source release order, artifact manifest, latest deploy time', () => {
    const html = renderToStaticMarkup(<EnvironmentVersionSummary version={fixture('upgrade')} />);

    expect(html).toContain('environmentVersionDeployedVersion');
    expect(html).toContain('environmentVersionCurrentValue');
    expect(html).toContain('environmentVersionSourceReleaseOrder');
    expect(html).toContain('order-1');
    expect(html).toContain('2.4.0-rc.1');
    expect(html).toContain('environmentVersionArtifactManifest');
    expect(html).toContain('manifest-1');
    expect(html).toContain('environmentVersionBuildRun');
    expect(html).toContain('&quot;revision&quot;:7');
    expect(html).toContain('sha256:exact');
    expect(html).toContain('environmentVersionLatestDeployedAt');
  });

  it('prefers deploymentRun.finishedAt as the latest deploy time and falls back to createdAt', () => {
    const finished = renderToStaticMarkup(
      <EnvironmentVersionSummary version={fixture('upgrade')} />,
    );
    const created = renderToStaticMarkup(
      <EnvironmentVersionSummary version={fixture('upgrade', { finishedAt: null })} />,
    );

    expect(finished).toContain(formatIso('2026-08-05T01:01:00Z'));
    expect(created).toContain(formatIso('2026-08-05T00:00:00Z'));
    expect(finished).not.toContain(formatIso('2026-08-05T00:00:00Z'));
  });
});

function fixture(
  kind: EnvironmentVersionItem['kind'],
  overrides?: Partial<EnvironmentVersionItem['deploymentRun']>,
): EnvironmentVersionItem {
  return {
    id: 'version-1',
    environmentId: 'environment-1',
    artifactManifestId: 'manifest-1',
    previousVersionId: null,
    kind,
    effectiveAt: '2026-08-05T00:00:00Z',
    releaseOrder: { id: 'order-1', releaseVersion: '2.4.0-rc.1' },
    artifactManifest: {
      id: 'manifest-1',
      digest: 'sha256:exact',
      buildRun: { id: 'build-1', revision: 7, sourceCommitSha: 'a'.repeat(40) },
    },
    deploymentRun: {
      id: 'deployment-1',
      status: 'completed',
      createdAt: '2026-08-05T00:00:00Z',
      finishedAt: '2026-08-05T01:01:00Z',
      ...overrides,
    },
  };
}
