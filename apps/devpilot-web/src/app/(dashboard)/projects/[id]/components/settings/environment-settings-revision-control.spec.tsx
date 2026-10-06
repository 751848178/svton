// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateEnvironmentConfigRevisionResult } from '../../types/environment-config-revision.types';
import { EnvironmentSettingsRevisionControl } from './environment-settings-revision-control';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('./environment-settings-revision-bar', () => ({
  EnvironmentSettingsRevisionBar: ({ onReview }: { onReview: () => void }) => (
    <button onClick={onReview}>review</button>
  ),
}));
vi.mock('./environment-settings-revision-modal', () => ({
  EnvironmentSettingsRevisionModal: (props: {
    open: boolean;
    error: string;
    result: CreateEnvironmentConfigRevisionResult | null;
    onConfirm: () => void;
    onClose: () => void;
  }) =>
    props.open ? (
      <div role="dialog">
        <span>{props.error}</span>
        <span>{props.result?.auditEvent.id}</span>
        <button onClick={props.onConfirm}>confirm</button>
        <button onClick={props.onClose}>close</button>
      </div>
    ) : null,
}));

describe('EnvironmentSettingsRevisionControl', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    reactActEnvironment().IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    reactActEnvironment().IS_REACT_ACT_ENVIRONMENT = false;
  });

  function renderControl(
    onSave: () => Promise<CreateEnvironmentConfigRevisionResult>,
    error = '',
    onResultDone = vi.fn(),
  ) {
    return act(async () =>
      root.render(
        <EnvironmentSettingsRevisionControl
          environmentName="Staging"
          summary="reason"
          revisions={[]}
          saving={false}
          loading={false}
          invalid={false}
          noChanges={false}
          changes={[]}
          blockers={[]}
          error={error}
          onSummaryChange={vi.fn()}
          onSave={onSave}
          onResultDone={onResultDone}
        />,
      ),
    );
  }

  it('keeps the modal open and exposes the exact audit result after success', async () => {
    const onResultDone = vi.fn();
    await renderControl(vi.fn().mockResolvedValue(resultFixture()), '', onResultDone);
    await act(async () => click('review'));
    await act(async () => click('confirm'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('audit-4');
    expect(onResultDone).not.toHaveBeenCalled();
    await act(async () => click('close'));
    expect(onResultDone).toHaveBeenCalledTimes(1);
  });

  it('keeps revision controls in the flat settings flow', async () => {
    await renderControl(vi.fn().mockResolvedValue(resultFixture()));
    const details = container.querySelector('details');
    expect(details?.dataset.settingsRevisionLayout).toBe('flat');
    expect(details?.className).not.toContain('rounded');
    expect(details?.className).not.toContain('shadow');
  });

  it('keeps the review open with the stable inline error after a rejected write', async () => {
    await renderControl(vi.fn().mockRejectedValue(new Error('CAS conflict')), 'CAS conflict');
    await act(async () => click('review'));
    await act(async () => click('confirm'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('CAS conflict');
  });

  function click(label: string) {
    const button = [...container.querySelectorAll('button')].find(
      (item) => item.textContent === label,
    );
    if (!button) throw new Error(`button ${label} missing`);
    button.click();
  }
});

function reactActEnvironment() {
  return globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
}

function resultFixture(): CreateEnvironmentConfigRevisionResult {
  return {
    environment: {
      id: 'env-1',
      key: 'staging',
      name: 'Staging',
      status: 'active',
      config: {},
      identityLockedAt: null,
      currentConfigRevisionId: 'rev-4',
    },
    revision: {
      id: 'rev-4',
      revision: 4,
      snapshotHash: 'hash-4',
      plainVariables: {},
      secretReferences: [],
      resourceReferences: [],
      routeSnapshot: {},
      policyReferences: [],
      source: 'project_management',
      createdAt: '2026-08-28T00:00:00Z',
      current: true,
    },
    auditEvent: {
      id: 'audit-4',
      action: 'project_environment.config_revision.create',
      targetType: 'environment_config_revision',
      targetId: 'rev-4',
      risk: 'medium',
      status: 'completed',
      summary: 'reason',
      occurredAt: '2026-08-28T00:00:00Z',
    },
  };
}
