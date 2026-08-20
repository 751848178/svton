// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseWorkbenchDecisionCard } from './release-workbench-decision-card';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('/')}` : key,
}));
vi.mock('@phosphor-icons/react', () => ({
  ArrowRight: () => <span />,
  Hammer: () => <span />,
  LockKey: () => <span />,
  WarningCircle: () => <span />,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick, loading, variant: _variant, ...props }: ButtonProps) => (
    <button onClick={onClick} disabled={props.disabled || loading} {...props}>{children}</button>
  ),
  LinkButton: ({ children, href, variant: _variant, ...props }: LinkProps) => (
    <a href={href} {...props}>{children}</a>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('ReleaseWorkbenchDecisionCard', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders one blocker decision and one truthful primary review action', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onReviewGate = vi.fn();
    await act(async () => root.render(
      <ReleaseWorkbenchDecisionCard
        {...baseProps}
        selectedStep="preflight"
        gate={{ ...gate, state: 'blocked', reason: 'exact Commit is missing' }}
        actionGate={{ allowed: false, reason: 'exact Commit is missing' }}
        onReviewGate={onReviewGate}
      />,
    ));

    expect(container.querySelectorAll('[data-release-decision]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="primary-release-action"]')).toHaveLength(1);
    expect(container.textContent).toContain('exact Commit is missing');
    expect(container.textContent).toContain('releaseWorkbenchReturnToExecution');
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-testid="primary-release-action"]')?.click(),
    );
    expect(onReviewGate).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it('makes Build the only primary action when the real gate allows it', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onBuildLatest = vi.fn();
    await act(async () => root.render(
      <ReleaseWorkbenchDecisionCard
        {...baseProps}
        decisionStep="build"
        executionStep="build"
        selectedStep="build"
        gate={{ ...gate, state: 'ready' }}
        actionGate={{ allowed: true, reason: '' }}
        onBuildLatest={onBuildLatest}
      />,
    ));

    const primary = container.querySelector<HTMLButtonElement>(
      '[data-testid="primary-release-action"]',
    );
    expect(primary?.textContent).toContain('buildLatestCode');
    expect(container.querySelectorAll('[data-testid="primary-release-action"]')).toHaveLength(1);
    await act(async () => primary?.click());
    expect(onBuildLatest).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });
});

const gate = {
  stage: 'build' as const,
  state: 'blocked' as const,
  blockerCount: 1,
  warningCount: 0,
  manualCount: 0,
  reason: null,
};

const baseProps = {
  decisionStep: 'build' as const,
  executionStep: 'staging' as const,
  building: false,
  buildFrozen: false,
  onBuildLatest: vi.fn(),
  onReviewGate: vi.fn(),
  onReturnToExecution: vi.fn(),
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
  variant?: string;
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  variant?: string;
}
