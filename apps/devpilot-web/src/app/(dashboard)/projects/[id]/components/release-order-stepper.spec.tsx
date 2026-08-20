// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderStep } from '../types/release-order.types';
import type { ReleaseOrderStepView } from './release-order-stepper.model';
import { ReleaseOrderStepper } from './release-order-stepper';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('/')}` : key,
}));

describe('ReleaseOrderStepper', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders a compact four-step execution line without repeating evidence summaries', async () => {
    await render(root, vi.fn());
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs).toHaveLength(4);
    expect(container.querySelectorAll('[data-connector="true"]')).toHaveLength(3);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'releaseStepNumber:01releaseStepPreflightTitlereleaseStepStateCompleted',
      'releaseStepNumber:02releaseStepBuildTitlereleaseOrderFailureBlocked',
      'releaseStepNumber:03releaseStepStagingTitlereleaseStepStateCurrent',
      'releaseStepNumber:04releaseStepProductionTitlereleaseStepStateWaiting',
    ]);
    expect(container.textContent).not.toContain('build-summary');
  });

  it('keeps selected and server-current semantics separate with a linked panel', async () => {
    await render(root, vi.fn());
    const selected = tab('build');
    const current = tab('staging');
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(selected.tabIndex).toBe(0);
    expect(selected.hasAttribute('aria-current')).toBe(false);
    expect(current.getAttribute('aria-current')).toBe('step');
    expect(current.getAttribute('aria-selected')).toBe('false');
    expect(container.textContent).toContain(
      'releaseWorkbenchExecutionContext:releaseStepStagingTitle',
    );
    expect(container.textContent).toContain(
      'releaseWorkbenchViewingContext:releaseStepBuildTitle',
    );
    expect(selected.className).toContain('bg-muted');
    expect(selected.querySelector('strong')?.className).not.toContain('text-primary');
    expect(current.querySelector('strong')?.className).toContain('text-primary');
    const panel = container.querySelector<HTMLElement>('[role="tabpanel"]');
    const controlledPanels = [...container.querySelectorAll('[role="tab"]')].map((tab) =>
      tab.getAttribute('aria-controls'),
    );
    expect(new Set(controlledPanels)).toEqual(new Set([panel?.id]));
    expect(document.getElementById(controlledPanels[0] || '')).toBe(panel);
    expect(panel?.getAttribute('aria-labelledby')).toBe(selected.id);
  });

  it.each([
    ['ArrowRight', 'staging'],
    ['ArrowDown', 'staging'],
    ['ArrowLeft', 'preflight'],
    ['ArrowUp', 'preflight'],
    ['Home', 'preflight'],
    ['End', 'production'],
  ])('handles %s with automatic selection and focus', async (key, expected) => {
    const onSelect = vi.fn();
    await render(root, onSelect);
    await act(async () =>
      tab('build').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })),
    );
    expect(onSelect).toHaveBeenLastCalledWith(expected);
    expect(document.activeElement).toBe(tab(expected));
  });

  it('wraps keyboard navigation within this tablist', async () => {
    const onSelect = vi.fn();
    await render(root, onSelect);
    await act(async () =>
      tab('preflight').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      ),
    );
    expect(onSelect).toHaveBeenLastCalledWith('production');
    expect(document.activeElement).toBe(tab('production'));
  });

  function tab(step: string) {
    const node = container.querySelector<HTMLButtonElement>(`[data-step="${step}"]`);
    if (!node) throw new Error(`missing ${step} tab`);
    return node;
  }
});

async function render(root: Root, onSelect: (step: ReleaseOrderStep) => void) {
  await act(async () => {
    root.render(
      <ReleaseOrderStepper
        steps={steps}
        selectedStep="build"
        onSelect={onSelect}
      >
        <p>active content</p>
      </ReleaseOrderStepper>,
    );
  });
}

const steps: ReleaseOrderStepView[] = [
  view('preflight', 1, 'completed', false, 'preflight-summary'),
  view('build', 2, 'blocked', false, 'build-summary'),
  view('staging', 3, 'current', true, 'staging-summary'),
  view('production', 4, 'waiting', false, 'production-summary'),
];

function view(
  key: ReleaseOrderStepView['key'],
  number: number,
  state: ReleaseOrderStepView['state'],
  isCurrent: boolean,
  summary: string,
): ReleaseOrderStepView {
  const title = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  return {
    key,
    number,
    state,
    isCurrent,
    labelKey: `releaseStep${title}Title` as ReleaseOrderStepView['labelKey'],
    stateLabelKey:
      state === 'blocked'
        ? 'releaseOrderFailureBlocked'
        : (`releaseStepState${titleCase(state)}` as ReleaseOrderStepView['stateLabelKey']),
    summary: { key: summary as ReleaseOrderStepView['summary']['key'] },
  };
}

function titleCase(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
