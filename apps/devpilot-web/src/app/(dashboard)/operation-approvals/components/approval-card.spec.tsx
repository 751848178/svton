// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationApproval } from '../types';
import { ApprovalCard } from './approval-card';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/hooks', () => ({ usePersistFn: (fn: unknown) => fn }));
vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  CodeBlock: () => null,
}));
vi.mock('./reject-reason-modal', () => ({ RejectReasonModal: () => null }));

describe('ApprovalCard permissions', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('renders review actions only when the API grants review capability', async () => {
    await render({ review: true });
    expect(button('approve')).not.toBeNull();
    expect(button('reject')).not.toBeNull();
  });

  it('renders an explicit read-only state for a team member', async () => {
    await render({ review: false });
    expect(button('approve')).toBeNull();
    expect(button('reject')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe('reviewRequiresAdmin');
  });

  async function render(capabilities: { review: boolean }) {
    await act(async () =>
      root.render(
        <ApprovalCard
          approval={approval(capabilities)}
          actingId=""
          onReview={vi.fn()}
          onExecute={vi.fn()}
        />,
      ),
    );
  }

  function button(label: string) {
    return (
      Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label) ??
      null
    );
  }
});

function approval(capabilities: { review: boolean }): OperationApproval {
  return {
    id: 'approval-1',
    category: 'release',
    action: 'project.release_order.deploy_production',
    targetType: 'release_run',
    risk: 'high',
    status: 'pending',
    requestedAt: '2026-08-09T00:00:00.000Z',
    capabilities,
  };
}
