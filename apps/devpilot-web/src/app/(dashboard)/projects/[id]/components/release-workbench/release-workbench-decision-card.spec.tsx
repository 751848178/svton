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
  Info: () => <span />,
  WarningCircle: () => <span />,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick, variant: _variant, ...props }: ButtonProps) => (
    <button onClick={onClick} {...props}>{children}</button>
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

  it('renders one blocker alert row and opens the preflight gate review on action', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onReviewGate = vi.fn();
    await act(async () => root.render(
      <ReleaseWorkbenchDecisionCard
        decisionStep="build"
        gate={{ ...gate, state: 'blocked', blockerCount: 1, reason: 'exact Commit is missing' }}
        onReviewGate={onReviewGate}
      />,
    ));

    expect(container.querySelectorAll('[data-release-decision]')).toHaveLength(1);
    expect(container.querySelector('[data-release-decision]')?.getAttribute('role')).toBe('alert');
    expect(container.querySelectorAll('[data-testid="primary-release-action"]')).toHaveLength(1);
    expect(container.textContent).toContain('releaseWorkbenchGateCounts');
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-testid="primary-release-action"]')?.click(),
    );
    expect(onReviewGate).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it('offers the target-repair link instead of the gate review when the blocker is targets', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(
      <ReleaseWorkbenchDecisionCard
        decisionStep="staging"
        gate={{ ...gate, state: 'blocked', blockerCount: 1 }}
        targetRepairHref="/projects/project-1/settings?section=environments&envTab=targets"
        onReviewGate={vi.fn()}
      />,
    ));
    const repair = container.querySelector<HTMLAnchorElement>(
      '[data-testid="primary-release-action"]',
    );
    expect(repair?.getAttribute('href')).toContain('envTab=targets');
    // 纯预警条不再承载构建/发布执行动作。
    expect(container.textContent).not.toContain('buildLatestCode');
    expect(container.textContent).not.toContain('releaseWorkbenchReturnToExecution');
    await act(async () => root.unmount());
  });

  it('keeps the ready state as a neutral status row without actions', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(
      <ReleaseWorkbenchDecisionCard
        decisionStep="build"
        gate={{ ...gate, state: 'ready', blockerCount: 0 }}
        onReviewGate={vi.fn()}
      />,
    ));
    expect(container.querySelector('[data-release-decision]')?.getAttribute('role')).toBe('status');
    expect(container.querySelector('[data-testid="primary-release-action"]')).toBeNull();
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

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: string;
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  variant?: string;
}
