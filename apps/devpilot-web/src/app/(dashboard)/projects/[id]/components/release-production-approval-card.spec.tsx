// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import { ReleaseProductionApprovalCard } from './release-production-approval-card';

const mocks = vi.hoisted(() => ({
  hook: {} as {
    acting: boolean;
    error: string;
    review: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  },
  onChanged: vi.fn(),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
  LinkButton: ({
    children,
    href,
    variant,
    size,
  }: {
    children: React.ReactNode;
    href: string;
    variant?: string;
    size?: string;
  }) => (
    <a
      href={href}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </a>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('@svton/ui', () => ({
  Modal: ({
    open,
    title,
    footer,
    children,
  }: {
    open: boolean;
    title: string;
    footer: React.ReactNode;
    children: React.ReactNode;
  }) =>
    open ? (
      <section aria-label={title}>
        {children}
        {footer}
      </section>
    ) : null,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));
vi.mock('@svton/hooks', () => ({ usePersistFn: (fn: unknown) => fn }));
vi.mock('../hooks/use-production-approval', () => ({
  useProductionApproval: () => mocks.hook,
}));

describe('ReleaseProductionApprovalCard', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.hook = {
      acting: false,
      error: '',
      review: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue(true),
    };
    mocks.onChanged.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('renders the pending approval with approve and reject actions', async () => {
    await render(run('pending'));
    expect(container.textContent).toContain('releaseProductionApprovalCardTitle');
    expect(buttonByText('releaseProductionApprove')).not.toBeNull();
    expect(buttonByText('releaseProductionReject')).not.toBeNull();
    expect(buttonByText('releaseProductionExecute')).toBeNull();
  });

  it('approve calls review(approved) and rejects without a comment are not sent', async () => {
    await render(run('pending'));
    act(() => buttonByText('releaseProductionApprove')?.click());
    expect(mocks.hook.review).toHaveBeenCalledWith('approved');
  });

  it('reject requires a reason: submit stays disabled until a comment is typed', async () => {
    await render(run('pending'));
    act(() => buttonByText('releaseProductionReject')?.click());

    const modal = container.querySelector('section');
    expect(modal).not.toBeNull();
    const confirm = () => buttonByText('reject');
    expect(confirm()).not.toBeNull();
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);

    const textarea = modal?.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      setter?.call(textarea, 'blocked by change window');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect((confirm() as HTMLButtonElement).disabled).toBe(false);

    act(() => confirm()?.click());
    expect(mocks.hook.review).toHaveBeenCalledWith('rejected', 'blocked by change window');
  });

  it('approved and unconsumed shows the execute action and renders reviewer metadata', async () => {
    const reviewed = new Date('2026-08-06T01:00:00.000Z').toISOString();
    await render(
      run('approved', {
        reviewerId: 'reviewer-1',
        reviewer: { id: 'reviewer-1', name: 'Reviewer', email: 'reviewer@example.com' },
        reviewedAt: reviewed,
        reviewComment: 'ok',
      }),
    );
    expect(buttonByText('releaseProductionExecute')).not.toBeNull();
    expect(buttonByText('releaseProductionApprove')).toBeNull();
    expect(container.textContent).toContain('releaseProductionApprovalReviewer');
    expect(container.textContent).toContain('releaseProductionApprovalReviewedAt');
    expect(container.textContent).toContain('releaseProductionApprovalComment');
  });

  it('executes once via the hook and keeps the approved state for an unconsumed approval', async () => {
    await render(run('approved'));
    act(() => buttonByText('releaseProductionExecute')?.click());
    expect(mocks.hook.execute).toHaveBeenCalledTimes(1);
  });

  it('hides the execute action once the approval is consumed', async () => {
    await render(run('approved', { consumedAt: '2026-08-06T02:00:00.000Z' }));
    expect(buttonByText('releaseProductionExecute')).toBeNull();
  });

  it('localizes the execute gate-denial error instead of the raw stage token', async () => {
    mocks.hook = { ...mocks.hook, error: 'admit 门禁未满足，服务端已拒绝执行' };
    await render(run('approved'));
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('releaseProductionGateDenied');
    expect(alert?.textContent).not.toContain('admit');
  });

  it('shows a recovery link for a rejected approval routed to Environment Versions', async () => {
    await render(run('rejected'));
    const recovery = container.querySelector('a');
    expect(recovery).not.toBeNull();
    expect(recovery?.getAttribute('href')).toBe('/projects/project-1?view=environment-versions');
    expect(recovery?.textContent).toContain('releaseProductionRecoveryLink');
  });

  it('renders recovery copy and executes a production recovery run', async () => {
    await render({ ...run('approved'), mode: 'recovery' });
    expect(container.textContent).toContain('releaseProductionRecoveryCardTitle');
    expect(buttonByText('releaseProductionRecoveryExecute')).not.toBeNull();
    expect(buttonByText('releaseProductionExecute')).toBeNull();
    act(() => buttonByText('releaseProductionRecoveryExecute')?.click());
    expect(mocks.hook.execute).toHaveBeenCalledTimes(1);
  });

  async function render(approved: ReleaseEvidenceProductionRun) {
    await act(async () =>
      root.render(
        <ReleaseProductionApprovalCard
          projectId="project-1"
          run={approved}
          onChanged={mocks.onChanged}
          recoveryHref="/projects/project-1?view=environment-versions"
        />,
      ),
    );
  }

  function buttonByText(text: string) {
    return (Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent === text,
    ) ?? null) as HTMLButtonElement | null;
  }
});

function run(
  status: 'pending' | 'approved' | 'rejected',
  overrides: Partial<ReleaseEvidenceProductionRun['operationApproval']> = {},
): ReleaseEvidenceProductionRun {
  return {
    id: 'release-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'prod-env-1',
    artifactManifestId: 'manifest-1',
    status: 'awaiting_approval',
    mode: 'standard',
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
      id: 'approval-1',
      status,
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
      ...overrides,
    },
    stagingProof: null,
    deploymentRuns: [],
  };
}
