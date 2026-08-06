import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentVersionItem } from '../types/environment-version.types';
import { EnvironmentVersionSummary } from './environment-version-summary';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe('EnvironmentVersionSummary', () => {
  it.each([
    ['deploy', 'environmentVersionKindDeploy'],
    ['upgrade', 'environmentVersionKindUpgrade'],
    ['recovery', 'environmentVersionKindRecovery'],
  ] as const)('labels the %s kind without exposing the raw code', (kind, labelKey) => {
    const html = renderToStaticMarkup(<EnvironmentVersionSummary version={fixture(kind)} />);

    expect(html).toContain('environmentVersionSummary');
    expect(html).toContain(labelKey);
    expect(html).toContain('environmentVersionBuildRun');
    expect(html).toContain('&quot;revision&quot;:7');
    expect(html).toContain('sha256:exact');
  });
});

function fixture(kind: EnvironmentVersionItem['kind']): EnvironmentVersionItem {
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
      finishedAt: '2026-08-05T00:01:00Z',
    },
  };
}
