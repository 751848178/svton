// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderEvidenceHook } from '../hooks/use-release-order-evidence';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { ReleaseOrderProductionStep } from './release-order-production-step';
import { ReleaseOrderStagingStep } from './release-order-staging-step';

const mocks = vi.hoisted(() => ({
  builds: {} as Record<string, unknown>,
  staging: {} as Record<string, unknown>,
  production: {} as Record<string, unknown>,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('../hooks/use-release-builds', () => ({ useReleaseBuilds: () => mocks.builds }));
vi.mock('../hooks/use-release-staging-deployments', () => ({
  useReleaseStagingDeployments: () => mocks.staging,
}));
vi.mock('../hooks/use-production-releases', () => ({
  useProductionReleases: () => mocks.production,
}));
vi.mock('./release-staging-evidence-list', () => ({ ReleaseStagingEvidenceList: () => null }));
vi.mock('./release-production-evidence-list', () => ({
  ReleaseProductionEvidenceList: () => null,
}));

describe('release order candidate sources', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.builds = {
      items: [build('build-unbounded', 'manifest-unbounded')],
      loading: false,
      error: '',
      load: vi.fn(),
    };
    mocks.staging = {
      items: [staging('manifest-unbounded')],
      loading: false,
      deploying: false,
      error: '',
      load: vi.fn(),
      deploy: vi.fn(),
    };
    mocks.production = {
      preview: null,
      confirming: false,
      error: '',
      confirm: vi.fn(),
    };
  });

  afterEach(async () => act(async () => root.unmount()));

  it('offers a staging Manifest absent from the bounded evidence history', async () => {
    await act(async () =>
      root.render(
        <ReleaseOrderStagingStep
          {...props()}
          focusedDeploymentRunId={undefined}
          onFocus={vi.fn()}
        />,
      ),
    );

    expect((container.querySelector('select') as HTMLSelectElement).value).toBe(
      'manifest-unbounded',
    );
  });

  it('offers a production Manifest proven by the complete staging history', async () => {
    await act(async () =>
      root.render(
        <ReleaseOrderProductionStep
          {...props()}
          focusedReleaseRunId={undefined}
          focusedDeploymentRunId={undefined}
          onFocus={vi.fn()}
        />,
      ),
    );

    expect((container.querySelector('select') as HTMLSelectElement).value).toBe(
      'manifest-unbounded',
    );
  });
});

function props() {
  return {
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    onChanged: vi.fn().mockResolvedValue(undefined),
    evidence: boundedEvidence(),
  };
}

function boundedEvidence() {
  return {
    evidence: {
      buildRuns: { items: [], total: 100, hasMore: true },
      stagingDeploymentRuns: { items: [], total: 100, hasMore: true },
      productionReleaseRuns: { items: [], total: 0, hasMore: false },
    },
    loading: false,
    error: '',
    load: vi.fn(),
  } as unknown as ReleaseOrderEvidenceHook;
}

function build(id: string, manifestId: string) {
  return {
    id,
    revision: 51,
    status: 'succeeded',
    manifest: { id: manifestId, digest: `sha256:${'a'.repeat(64)}` },
  } as ReleaseBuildItem;
}

function staging(manifestId: string) {
  return {
    id: 'staging-old',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    status: 'completed',
    artifactManifestId: manifestId,
  } as ReleaseStagingDeploymentItem;
}
