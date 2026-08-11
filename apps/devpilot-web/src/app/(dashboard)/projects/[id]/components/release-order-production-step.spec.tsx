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
  resume: vi.fn(),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  Modal: () => null,
  Drawer: () => null,
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
vi.mock('../hooks/use-production-promotion-resume', () => ({
  useProductionPromotionResume: () => ({ resume: mocks.resume, resuming: false, error: '' }),
}));
vi.mock('@/components/ui', () => ({
  Button: ({
    loading: _loading,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => <button {...props} />,
  EmptyState: () => null,
  ErrorBanner: () => null,
  Modal: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) => open ? <section aria-label={title}>{children}{footer}</section> : null,
  LinkButton: ({ href, children }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('./release-production-log-drawer', () => ({
  ReleaseProductionLogDrawer: () => null,
}));
vi.mock('./release-production-evidence-list', () => ({
  ReleaseProductionEvidenceList: () => null,
}));
vi.mock('./release-production-approval-card', () => ({
  ReleaseProductionApprovalCard: ({ run }: { run: { id: string } }) => (
    <div data-approval-card-for={run.id} />
  ),
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
    mocks.resume.mockReset();
    mocks.resume.mockResolvedValue({ status: 'succeeded' });
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
    expect(dialogSection()).toBeNull();
  });

  it('always opens the confirmation dialog on click', async () => {
    await render();
    act(() => triggerButton()?.click());

    expect(dialogSection()).not.toBeNull();
  });

  it('shows environment, version, build/commit, manifest, config and policy fields', async () => {
    await render();
    act(() => triggerButton()?.click());
    const dialog = dialogSection()?.textContent || '';

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
    expect(dialogSection()).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('primary confirm calls production.confirm exactly once and closes on success', async () => {
    const confirm = vi.fn().mockResolvedValue({ id: 'run-1' });
    mocks.production = { ...mocks.production, confirm };
    await render();
    act(() => triggerButton()?.click());

    await act(async () => confirmButton()?.click());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dialogSection()).toBeNull();
  });

  it('keeps the dialog open and shows the error when confirm fails', async () => {
    const confirm = vi.fn().mockResolvedValue(null);
    mocks.production = { ...mocks.production, confirm, error: 'releaseProductionRunScopeMismatch' };
    await render();
    act(() => triggerButton()?.click());

    await act(async () => confirmButton()?.click());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dialogSection()).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'releaseProductionRunScopeMismatch',
    );
  });

  it('renders the project-context approval card for the latest production ReleaseRun', async () => {
    const evidence = {
      evidence: {
        buildRuns: { items: [], total: 0, hasMore: false },
        stagingDeploymentRuns: { items: [], total: 0, hasMore: false },
        productionReleaseRuns: {
          items: [productionRun('release-latest'), productionRun('release-old')],
          total: 2,
          hasMore: false,
        },
      },
      loading: false,
      error: '',
      load: vi.fn(),
    } as unknown as ReleaseOrderEvidenceHook;
    await act(async () =>
      root.render(
        <ReleaseOrderProductionStep
          {...props(evidence)}
          focusedReleaseRunId={undefined}
          focusedDeploymentRunId={undefined}
          onFocus={vi.fn()}
        />,
      ),
    );

    expect(container.querySelector('[data-approval-card-for="release-latest"]')).not.toBeNull();
  });

  it('renders the approval card for the explicitly focused ReleaseRun', async () => {
    const evidence = {
      evidence: {
        buildRuns: { items: [], total: 0, hasMore: false },
        stagingDeploymentRuns: { items: [], total: 0, hasMore: false },
        productionReleaseRuns: {
          items: [productionRun('release-latest'), productionRun('release-old')],
          total: 2,
          hasMore: false,
        },
      },
      loading: false,
      error: '',
      load: vi.fn(),
    } as unknown as ReleaseOrderEvidenceHook;
    await act(async () =>
      root.render(
        <ReleaseOrderProductionStep
          {...props(evidence)}
          focusedReleaseRunId="release-old"
          focusedDeploymentRunId={undefined}
          onFocus={vi.fn()}
        />,
      ),
    );

    expect(container.querySelector('[data-approval-card-for="release-old"]')).not.toBeNull();
  });

  it('keeps exactly one enabled primary action when no active ReleaseRun exists', async () => {
    const evidence = {
      evidence: {
        buildRuns: { items: [], total: 0, hasMore: false },
        stagingDeploymentRuns: { items: [], total: 0, hasMore: false },
        productionReleaseRuns: { items: [], total: 0, hasMore: false },
      },
      loading: false,
      error: '',
      load: vi.fn(),
    } as unknown as ReleaseOrderEvidenceHook;
    await act(async () =>
      root.render(
        <ReleaseOrderProductionStep
          {...props(evidence)}
          focusedReleaseRunId={undefined}
          focusedDeploymentRunId={undefined}
          onFocus={vi.fn()}
        />,
      ),
    );
    const primaries = Array.from(container.querySelectorAll('[data-primary="true"]')).filter(
      (element) => !(element as HTMLButtonElement).disabled,
    );
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.textContent).toContain('requestProductionApproval');
  });

  it('disables the request-approval button when an active ReleaseRun exists (single primary)', async () => {
    const evidence = {
      evidence: {
        buildRuns: { items: [], total: 0, hasMore: false },
        stagingDeploymentRuns: { items: [], total: 0, hasMore: false },
        productionReleaseRuns: {
          items: [productionRun('release-active')],
          total: 1,
          hasMore: false,
        },
      },
      loading: false,
      error: '',
      load: vi.fn(),
    } as unknown as ReleaseOrderEvidenceHook;
    await act(async () =>
      root.render(
        <ReleaseOrderProductionStep
          {...props(evidence)}
          focusedReleaseRunId={undefined}
          focusedDeploymentRunId={undefined}
          onFocus={vi.fn()}
        />,
      ),
    );
    const primaries = Array.from(container.querySelectorAll('[data-primary="true"]')).filter(
      (element) => !(element as HTMLButtonElement).disabled,
    );
    expect(primaries).toHaveLength(0);
    const disabledRequest = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === 'releaseProductionAwaitingApprovalDisabled',
    );
    expect(disabledRequest).not.toBeNull();
  });

  it('shows the exact continue-release task while Production awaits validation', async () => {
    const awaiting = productionRun('release-awaiting');
    awaiting.status = 'awaiting_validation';
    awaiting.operationApproval.status = 'approved';
    awaiting.deploymentRuns = [{
      id: 'deployment-awaiting',
      environmentId: awaiting.environmentId,
      status: 'awaiting_validation',
      result: {
        productionCandidate: {
          candidateHash: 'a'.repeat(64),
          releaseOrderId: awaiting.releaseOrderId,
          manifestId: awaiting.artifactManifestId,
        },
      },
    }] as never;
    const evidence = {
      evidence: {
        buildRuns: { items: [], total: 0, hasMore: false },
        stagingDeploymentRuns: { items: [], total: 0, hasMore: false },
        productionReleaseRuns: { items: [awaiting], total: 1, hasMore: false },
      },
      loading: false,
      error: '',
      load: vi.fn(),
    } as unknown as ReleaseOrderEvidenceHook;
    await act(async () => root.render(
      <ReleaseOrderProductionStep
        {...props(evidence)}
        focusedReleaseRunId="release-awaiting"
        focusedDeploymentRunId={undefined}
        onFocus={vi.fn()}
      />,
    ));

    expect(container.textContent).toContain('environmentVersionAwaitingValidation');
    const continueButton = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === 'environmentVersionContinueProduction',
    );
    expect(continueButton).not.toBeNull();
    await act(async () => continueButton?.click());
    expect(mocks.resume).toHaveBeenCalledWith({
      releaseRunId: 'release-awaiting',
      deploymentRunId: 'deployment-awaiting',
      candidateHash: 'a'.repeat(64),
    });
  });

  it('does not offer a new production approval after the release artifact is frozen', async () => {
    await act(async () =>
      root.render(
        <ReleaseOrderProductionStep
          {...props()}
          productionArtifactFrozen
          focusedReleaseRunId={undefined}
          focusedDeploymentRunId={undefined}
          onFocus={vi.fn()}
        />,
      ),
    );
    expect(triggerButton()).toBeUndefined();
    const frozen = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === 'releaseProductionArtifactFrozen',
    );
    expect(frozen).not.toBeNull();
    expect((frozen as HTMLButtonElement).disabled).toBe(true);
  });

  it('localizes the gate-denial error without leaking the internal stage token', async () => {
    const evidence = {
      evidence: {
        buildRuns: { items: [], total: 0, hasMore: false },
        stagingDeploymentRuns: { items: [], total: 0, hasMore: false },
        productionReleaseRuns: { items: [], total: 0, hasMore: false },
      },
      loading: false,
      error: '',
      load: vi.fn(),
    } as unknown as ReleaseOrderEvidenceHook;
    mocks.production = {
      preview: { inputHash: 'input-hash', snapshot: snapshot() },
      confirming: false,
      error: 'admit 门禁未满足，服务端已拒绝执行',
      confirm: vi.fn(),
    };
    await act(async () =>
      root.render(
        <ReleaseOrderProductionStep
          {...props(evidence)}
          focusedReleaseRunId={undefined}
          focusedDeploymentRunId={undefined}
          onFocus={vi.fn()}
        />,
      ),
    );
    const alerts = container.querySelectorAll('[role="alert"]');
    let leakFound = false;
    alerts.forEach((alert) => {
      const text = alert.textContent || '';
      if (
        text.includes('admit') ||
        text.includes('finalize') ||
        text.includes('门禁未满足，服务端已拒绝执行')
      ) {
        leakFound = true;
      }
    });
    expect(leakFound).toBe(false);
    expect(container.textContent).toContain('releaseProductionGateDenied');
  });

  it('renders the Demo-aligned context strip and stage summary labels', async () => {
    const evidence = {
      evidence: {
        buildRuns: { items: [], total: 0, hasMore: false },
        stagingDeploymentRuns: { items: [], total: 0, hasMore: false },
        productionReleaseRuns: {
          items: [productionRun('release-latest')],
          total: 1,
          hasMore: false,
        },
      },
      loading: false,
      error: '',
      load: vi.fn(),
    } as unknown as ReleaseOrderEvidenceHook;
    await act(async () =>
      root.render(
        <ReleaseOrderProductionStep
          {...props(evidence)}
          focusedReleaseRunId={undefined}
          focusedDeploymentRunId={undefined}
          onFocus={vi.fn()}
        />,
      ),
    );
    const text = container.textContent || '';
    expect(text).toContain('releaseContextCurrentOnline');
    expect(text).toContain('releaseContextDelivering');
    expect(text).toContain('releaseContextTodos');
    expect(text).toContain('releaseContextReleaseOrder');
    expect(text).toContain('releaseStageSummaryCurrentOnline');
    expect(text).toContain('releaseStageSummaryArtifact');
    expect(text).toContain('releaseStageSummaryPrerequisite');
    expect(container.querySelector('[data-context-strip="true"]')).not.toBeNull();
    expect(container.querySelector('[data-stage-summary="true"]')).not.toBeNull();
  });

  function triggerButton() {
    return Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === 'requestProductionApproval',
    );
  }

  function dialogSection() {
    return container.querySelector('section[aria-label="releaseProductionConfirmTitle"]') || null;
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

  function props(evidence?: ReleaseOrderEvidenceHook) {
    return {
      projectId: 'project-1',
      releaseOrderId: 'order-1',
      releaseVersion: 'v1.3.0',
      productionArtifactFrozen: false,
      recoveryHref: '/projects/project-1?view=environment-versions',
      onOpenLog: vi.fn(),
      onCloseLog: vi.fn(),
      onChanged: vi.fn().mockResolvedValue(undefined),
      evidence:
        evidence ||
        ({
          evidence: {
            buildRuns: { items: [], total: 0, hasMore: false },
            stagingDeploymentRuns: { items: [], total: 0, hasMore: false },
            productionReleaseRuns: { items: [], total: 0, hasMore: false },
          },
          loading: false,
          error: '',
          load: vi.fn(),
        } as unknown as ReleaseOrderEvidenceHook),
    };
  }
});

function productionRun(id: string) {
  return {
    id,
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'prod-env-1',
    artifactManifestId: 'manifest-1',
    status: 'awaiting_approval',
    verifiedDigest: 'sha256:exact',
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-08-06T00:00:00.000Z',
    environment: { id: 'prod-env-1', name: 'Production', baselineRole: 'production' },
    manifest: {
      id: 'manifest-1',
      digest: 'sha256:exact',
      createdAt: '2026-08-06T00:00:00.000Z',
      buildRun: {
        id: 'build-1',
        revision: 1,
        sourceBranch: 'main',
        sourceCommitSha: 'a'.repeat(40),
      },
      items: [],
    },
    operationApproval: {
      id: `approval-${id}`,
      status: 'pending',
      risk: 'high',
      summary: '生产发布 1.0.0 / Build #1',
      requesterId: 'user-1',
      reviewerId: null,
      requester: { id: 'user-1', name: 'Requester', email: 'requester@example.com' },
      reviewer: null,
      reviewComment: null,
      requestedAt: '2026-08-06T00:00:00.000Z',
      reviewedAt: null,
      consumedAt: null,
      expiresAt: null,
    },
    stagingProof: null,
    deploymentRuns: [],
  };
}

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
