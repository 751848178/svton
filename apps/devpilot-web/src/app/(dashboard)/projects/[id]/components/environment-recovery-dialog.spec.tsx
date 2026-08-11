// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVersionEnvironment } from '../types/environment-version.types';
import { EnvironmentRecoveryDialog } from './environment-recovery-dialog';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  onConfirmed: vi.fn(),
  onClose: vi.fn(),
  onDirectConfirm: vi.fn(),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('@svton/ui', () => ({
  Dialog: ({
    children,
    title,
    onConfirm,
    confirmDisabled,
    confirmText,
  }: {
    children: React.ReactNode;
    title?: string;
    onConfirm: () => void;
    confirmDisabled?: boolean;
    confirmText?: string;
  }) => (
    <section>
      <h2>{title}</h2>
      {children}
      <button
        data-testid="confirm"
        onClick={onConfirm}
        disabled={confirmDisabled}
      >
        {confirmText}
      </button>
    </section>
  ),
}));
vi.mock('../hooks/use-recovery-confirm', () => ({
  useRecoveryConfirm: () => ({
    working: false,
    error: '',
    preview: vi.fn().mockResolvedValue(null),
    create: mocks.create,
  }),
}));

describe('EnvironmentRecoveryDialog', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    container = document.createElement('div');
    root = createRoot(container);
    mocks.create.mockReset();
    mocks.onConfirmed.mockReset();
    mocks.onClose.mockReset();
    mocks.onDirectConfirm.mockReset();
  });

  afterEach(async () => act(async () => root.unmount()));

  it('renders the rollback dialog with the callout, current version and create action', async () => {
    await render('version-history');
    expect(container.textContent).toContain('environmentVersionRecoveryDialogTitle');
    expect(container.textContent).toContain('environmentVersionRecoveryDialogCallout');
    expect(container.textContent).toContain('environmentVersionRecoveryTarget');
    expect(container.textContent).toContain('environmentVersionCurrent');
    expect(container.textContent).toContain('environmentVersionRecoveryCreateAction');
  });

  it('creates the recovery deployment once on confirm and reports the created run', async () => {
    mocks.create.mockResolvedValueOnce({ run: { id: 'recovery-run-1' }, preview: {} });
    await render('version-history');
    await act(async () => {
      confirmButton().click();
    });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith('environment-prod', 'version-history');
    expect(mocks.onConfirmed).toHaveBeenCalledWith(
      { run: { id: 'recovery-run-1' }, preview: {} },
      'version-history',
    );
  });

  it('keeps the create action disabled while the selected version is missing', async () => {
    await render('unknown-version');
    expect((confirmButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists only historical versions (current excluded) with the last-success default labeled', async () => {
    await render('version-history');
    const options = [...container.querySelectorAll('option')];
    expect(options.map((option) => option.value)).toEqual(['version-history']);
    expect(options[0].textContent).toContain('environmentVersionRecoveryDefaultRecommend');
    expect(container.textContent).not.toContain('version-current');
    expect(options[0].value).toBe('version-history');
  });

  it('defaults to the last successful version and accepts no free-text version input', async () => {
    await render('version-history');
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('version-history');
    expect(container.querySelector('input')).toBeNull();
  });

  it('executes the recovery directly for Staging and closes the dialog', async () => {
    mocks.onDirectConfirm.mockResolvedValueOnce(undefined);
    await renderDirect('version-history');
    await act(async () => {
      confirmButton().click();
    });
    expect(mocks.onDirectConfirm).toHaveBeenCalledTimes(1);
    expect(mocks.onDirectConfirm).toHaveBeenCalledWith('version-history');
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  async function render(sourceVersionId: string) {
    await act(async () =>
      root.render(
        <EnvironmentRecoveryDialog
          projectId="project-1"
          environment={environment()}
          defaultSourceVersionId={sourceVersionId}
          onClose={mocks.onClose}
          onConfirmed={mocks.onConfirmed}
        />,
      ),
    );
  }

  async function renderDirect(sourceVersionId: string) {
    await act(async () =>
      root.render(
        <EnvironmentRecoveryDialog
          projectId="project-1"
          environment={environment()}
          defaultSourceVersionId={sourceVersionId}
          onClose={mocks.onClose}
          onDirectConfirm={mocks.onDirectConfirm}
        />,
      ),
    );
  }

  function confirmButton() {
    return container.querySelector('[data-testid="confirm"]') as HTMLButtonElement;
  }
});

function environment(): EnvironmentVersionEnvironment {
  return {
    id: 'environment-prod',
    key: 'production',
    name: 'Production',
    baselineRole: 'production',
    currentEnvironmentVersionId: 'version-current',
    targetReadiness: readyTarget('environment-prod', 'production'),
    environmentVersions: [
      version('version-current'),
      version('version-history'),
    ],
  };
}

function readyTarget(environmentId: string, environmentKey: string) {
  return {
    environmentId,
    environmentKey,
    expectedProviderKey: 'ssh-v1',
    bindingCount: 1,
    matchState: 'ready' as const,
    reasonCode: 'TARGET_READY' as const,
    remediation: null,
    currentTarget: null,
  };
}

function version(id: string) {
  return {
    id,
    environmentId: 'environment-prod',
    artifactManifestId: 'manifest-1',
    previousVersionId: null,
    kind: 'upgrade',
    effectiveAt: '2026-08-05T00:00:00Z',
    releaseOrder: { id: 'order-1', releaseVersion: '2.4.0' },
    artifactManifest: {
      id: 'manifest-1',
      digest: 'sha256:exact',
      buildRun: { id: 'build-1', revision: 7, sourceCommitSha: 'a'.repeat(40) },
    },
    deploymentRun: {
      id: `deployment-${id}`,
      status: 'completed',
      createdAt: '2026-08-05T00:00:00Z',
      finishedAt: '2026-08-05T00:01:00Z',
    },
  } as const;
}
