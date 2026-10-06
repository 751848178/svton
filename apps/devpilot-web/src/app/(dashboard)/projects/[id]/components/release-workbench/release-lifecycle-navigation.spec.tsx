// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ReleaseLifecycleStageView,
  ReleaseLifecycleStepView,
} from './release-lifecycle.model';
import { ReleaseLifecycleRail } from './release-lifecycle-rail';
import { ReleaseLifecycleSubsteps } from './release-lifecycle-substeps';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('release lifecycle navigation semantics', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('links major-stage tabs to panels and skips disabled stages with arrow keys', async () => {
    const onSelect = vi.fn();
    await act(async () =>
      root.render(
        <ReleaseLifecycleRail
          stages={stages()}
          selected="staging"
          onSelect={onSelect}
        />,
      ),
    );
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs[0]?.id).toBe('release-lifecycle-stage-tab-staging');
    expect(tabs[0]?.getAttribute('aria-controls')).toBe('release-lifecycle-stage-panel-staging');
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('production');
    expect(document.activeElement).toBe(tabs[1]);
    tabs[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onSelect).toHaveBeenLastCalledWith('staging');
  });

  it('uses roving tab focus and skips disabled child steps in both axes', async () => {
    const onSelect = vi.fn();
    await act(async () =>
      root.render(
        <ReleaseLifecycleSubsteps
          steps={steps()}
          selected="preflight"
          onSelect={onSelect}
        />,
      ),
    );
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs[0]?.getAttribute('aria-controls')).toBe('release-lifecycle-step-panel-preflight');
    tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('stagingDeploy');
    expect(document.activeElement).toBe(tabs[2]);
  });
});

function stages(): ReleaseLifecycleStageView[] {
  return [
    { key: 'staging', state: 'current', labelKey: 'staging', descriptionKey: 'staging', steps: [] },
    {
      key: 'production',
      state: 'available',
      labelKey: 'production',
      descriptionKey: 'production',
      steps: [],
    },
    {
      key: 'validation',
      state: 'disabled',
      labelKey: 'validation',
      descriptionKey: 'validation',
      steps: [],
    },
    {
      key: 'complete',
      state: 'disabled',
      labelKey: 'complete',
      descriptionKey: 'complete',
      steps: [],
    },
  ];
}

function steps(): ReleaseLifecycleStepView[] {
  return [
    { key: 'preflight', state: 'current', labelKey: 'preflight', descriptionKey: 'preflight' },
    { key: 'build', state: 'disabled', labelKey: 'build', descriptionKey: 'build' },
    { key: 'stagingDeploy', state: 'available', labelKey: 'deploy', descriptionKey: 'deploy' },
  ];
}
