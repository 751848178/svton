// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVersionEnvironment } from '../../types/environment-version.types';
import { EnvironmentVersionRecoveryControl } from './environment-version-recovery-control';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), refresh: vi.fn() }));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}));
vi.mock('../environment-recovery-dialog', () => ({
  EnvironmentRecoveryDialog: (props: {
    defaultSourceVersionId: string;
    onClose: () => void;
    onConfirmed: () => void;
    onDirectConfirm?: (sourceVersionId: string) => Promise<void>;
  }) => (
    <section
      role="dialog"
      data-default={props.defaultSourceVersionId}
    >
      <button onClick={() => void props.onDirectConfirm?.(props.defaultSourceVersionId)}>
        direct
      </button>
      <button onClick={props.onConfirmed}>confirmed</button>
      <button onClick={props.onClose}>close</button>
    </section>
  ),
}));

describe('EnvironmentVersionRecoveryControl', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    mocks.execute.mockReset();
    mocks.refresh.mockReset();
  });

  afterEach(async () => act(async () => root.unmount()));

  it('does not advertise recovery without a historical environment version', async () => {
    await render(environment('staging', false));
    expect(container.querySelector('button')).toBeNull();
  });

  it('executes Staging recovery against the latest historical version', async () => {
    mocks.execute.mockResolvedValueOnce({ deploymentRun: { id: 'run-1' } });
    await render(environment('staging', true));
    await click('environmentVersionRecoveryDialogTitle');
    expect(container.querySelector('[role="dialog"]')?.getAttribute('data-default')).toBe('old-2');
    await click('direct');
    expect(mocks.execute).toHaveBeenCalledWith('env-1', {
      kind: 'recovery',
      sourceVersionId: 'old-2',
    });
  });

  it('refreshes and closes after Production recovery is confirmed by the API flow', async () => {
    await render(environment('production', true));
    await click('environmentVersionRecoveryDialogTitle');
    await click('confirmed');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  async function render(environmentValue: EnvironmentVersionEnvironment) {
    await act(async () =>
      root.render(
        <EnvironmentVersionRecoveryControl
          projectId="project-1"
          environment={environmentValue}
          execute={mocks.execute}
          refresh={mocks.refresh}
        />,
      ),
    );
  }

  async function click(label: string) {
    const button = [...container.querySelectorAll('button')].find(
      (item) => item.textContent === label,
    );
    expect(button).toBeTruthy();
    await act(async () => button!.click());
  }
});

function environment(role: 'staging' | 'production', withHistory: boolean) {
  const versions = [version('current', '2026-08-28T00:00:00Z')];
  if (withHistory)
    versions.push(
      version('old-1', '2026-08-01T00:00:00Z'),
      version('old-2', '2026-08-20T00:00:00Z'),
    );
  return {
    id: 'env-1',
    key: role,
    name: role,
    baselineRole: role,
    currentEnvironmentVersionId: 'current',
    targetReadiness: {
      environmentId: 'env-1',
      environmentKey: role,
      expectedProviderKey: 'ssh-v1',
      bindingCount: 1,
      matchState: 'ready',
      reasonCode: 'TARGET_READY',
      remediation: null,
      currentTarget: null,
    },
    environmentVersions: versions,
  } as unknown as EnvironmentVersionEnvironment;
}

function version(id: string, effectiveAt: string) {
  return {
    id,
    environmentId: 'env-1',
    artifactManifestId: `manifest-${id}`,
    previousVersionId: null,
    kind: 'upgrade',
    effectiveAt,
    releaseOrder: { id: `order-${id}`, releaseVersion: '1.0.0' },
    artifactManifest: {
      id: `manifest-${id}`,
      digest: `sha256:${id}`,
      buildRun: { id: `build-${id}`, revision: 1, sourceCommitSha: 'a'.repeat(40) },
    },
    deploymentRun: null,
  } as const;
}
