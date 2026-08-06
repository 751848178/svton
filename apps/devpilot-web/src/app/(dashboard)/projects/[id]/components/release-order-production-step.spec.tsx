// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderEvidenceHook } from '../hooks/use-release-order-evidence';
import type {
  ProductionReleaseSnapshot,
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../types/release-order.types';
import { ReleaseOrderProductionStep } from './release-order-production-step';

const mocks = vi.hoisted(() => ({
  builds: {} as Record<string, unknown>,
  staging: {} as Record<string, unknown>,
  production: {} as Record<string, unknown>,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  Modal: () => null,
  Dialog: ({
    open,
    title,
    children,
    confirmText,
    cancelText,
    onClose,
    onConfirm,
    loading,
    confirmDisabled,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    confirmText: string;
    cancelText: string;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
    confirmDisabled: boolean;
  }) =>
    open ? (
      <section aria-label={title}>
        <div>{children}</div>
        <button
          onClick={onClose}
          disabled={loading}
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || confirmDisabled}
        >
          {confirmText}
        </button>
      </section>
    ) : null,
  LoadingState: () => null,
}));
vi.mock('../hooks/use-release-builds', () => ({ useReleaseBuilds: () => mocks.builds }));
vi.mock('../hooks/use-release-staging-deployments', () => ({
  useReleaseStagingDeployments: () => mocks.staging,
}));
vi.mock('../hooks/use-production-releases', () => ({
  useProductionReleases: () => mocks.production,
}));
vi.mock('./release-production-evidence-list', () => ({
  ReleaseProductionEvidenceList: () => null,
}));

describe('ReleaseOrderProductionStep confirmation dialog', () => {
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
      items: [build('build-1', 'manifest-1')],
      loading: false,
      error: '',
      load: vi.fn(),
    };
    mocks.staging = {
      items: [staging('manifest-1')],
      total: 1,
      loading: false,
      error: '',
      load: vi.fn(),
    };
    mocks.production = {
      preview: { inputHash: 'input-hash', snapshot: snapshot() },
      confirming: false,
      error: '',
      confirm: vi.fn().mockResolvedValue({ id: 'run-1' }),
    };
  });

  afterEach(async () => act(async () => root.unmount()));

  it('disables the publish button when no snapshot is available', async () => {
    mocks.production = {
      preview: null,
      confirming: false,
      error: '',
      confirm: vi.fn(),
    };
    await render();

    const button = triggerButton();
    expect(button).not.toBeNull();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('section')).toBeNull();
  });

  it('always opens the confirmation dialog on click', async () => {
    await render();
    act(() => triggerButton()?.click());

    expect(container.querySelector('section')).not.toBeNull();
  });

  it('shows environment, version, build/commit, manifest, config and policy fields', async () => {
    await render();
    act(() => triggerButton()?.click());
    const dialog = container.querySelector('section')?.textContent || '';

    expect(dialog).toContain('releaseProductionEnvironment');
    expect(dialog).toContain('releaseEnvironmentProduction');
    expect(dialog).toContain('releaseProductionVersion');
    expect(dialog).toContain('v1.3.0');
    expect(dialog).toContain('releaseProductionReuseArtifact');
    expect(dialog).toContain('build-1 · R42');
    expect(dialog).toContain('manifest-1 · sha256:');
    expect(dialog).toContain('releaseProductionBuild');
    expect(dialog).toContain('R42 · main ·');
    expect(dialog).toContain('releaseProductionConfigSnapshot');
    expect(dialog).toContain('R7 · hash-cfg');
    expect(dialog).toContain('releaseProductionResourceCount');
    expect(dialog).toContain('releaseProductionRouteCount');
    expect(dialog).toContain('releaseProductionReleaseStrategy');
    expect(dialog).toContain('releasePolicySynthetic');
    expect(dialog).toContain('releasePolicyStrategyStandard');
    expect(dialog).toContain('releaseProductionStagingProvenNote');
  });

  it('cancel closes the dialog without calling confirm', async () => {
    const confirm = vi.fn().mockResolvedValue({ id: 'run-1' });
    mocks.production = { ...mocks.production, confirm };
    await render();
    act(() => triggerButton()?.click());

    act(() => cancelButton()?.click());
    expect(container.querySelector('section')).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('primary confirm calls production.confirm exactly once and closes on success', async () => {
    const confirm = vi.fn().mockResolvedValue({ id: 'run-1' });
    mocks.production = { ...mocks.production, confirm };
    await render();
    act(() => triggerButton()?.click());

    await act(async () => confirmButton()?.click());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(container.querySelector('section')).toBeNull();
  });

  it('keeps the dialog open and shows the error when confirm fails', async () => {
    const confirm = vi.fn().mockResolvedValue(null);
    mocks.production = { ...mocks.production, confirm, error: 'releaseProductionRunScopeMismatch' };
    await render();
    act(() => triggerButton()?.click());

    await act(async () => confirmButton()?.click());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(container.querySelector('section')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'releaseProductionRunScopeMismatch',
    );
  });

  function triggerButton() {
    return Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === 'requestProductionApproval',
    );
  }

  function cancelButton() {
    return Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === 'releaseGateCancel',
    );
  }

  function confirmButton() {
    return Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === 'releaseProductionConfirmAction',
    );
  }

  async function render() {
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
  }

  function props() {
    return {
      projectId: 'project-1',
      releaseOrderId: 'order-1',
      onChanged: vi.fn().mockResolvedValue(undefined),
      evidence: {
        evidence: {
          buildRuns: { items: [], total: 0, hasMore: false },
          stagingDeploymentRuns: { items: [], total: 0, hasMore: false },
          productionReleaseRuns: { items: [], total: 0, hasMore: false },
        },
        loading: false,
        error: '',
        load: vi.fn(),
      } as unknown as ReleaseOrderEvidenceHook,
    };
  }
});

function snapshot(): ProductionReleaseSnapshot {
  return {
    version: 2,
    projectId: 'project-1',
    releaseOrder: { id: 'order-1', releaseVersion: 'v1.3.0' },
    environment: { id: 'prod-1', key: 'prod', name: 'Production', baselineRole: 'production' },
    build: { id: 'build-1', revision: 42, sourceBranch: 'main', sourceCommitSha: 'a'.repeat(40) },
    manifest: { id: 'manifest-1', digest: `sha256:${'b'.repeat(64)}` },
    stagingProof: {
      deploymentRunId: 'staging-run-1',
      environmentId: 'staging-1',
      finishedAt: '2026-08-06T00:00:00.000Z',
    },
    config: {
      revisionId: 'cfg-1',
      revision: 7,
      snapshotHash: 'hash-cfg',
      resourceSnapshot: [{ id: 'r1' }, { id: 'r2' }],
      routeSnapshot: [{ id: 'route-1' }],
      policySnapshot: {},
    },
    releasePolicy: {
      revisionId: null,
      revision: 1,
      strategy: 'standard',
      requireProductionApproval: true,
      snapshotHash: 'hash-policy',
      synthetic: true,
    },
  };
}

function build(id: string, manifestId: string) {
  return {
    id,
    revision: 42,
    status: 'succeeded',
    manifest: { id: manifestId, digest: `sha256:${'a'.repeat(64)}` },
  } as ReleaseBuildItem;
}

function staging(manifestId: string) {
  return {
    id: 'staging-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    status: 'completed',
    artifactManifestId: manifestId,
  } as ReleaseStagingDeploymentItem;
}
