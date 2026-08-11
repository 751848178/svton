// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
} from '../types/environment-version.types';
import { EnvironmentAwaitingPromotion } from './environment-awaiting-promotion';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('view=environment-versions') }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, loading: _loading, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
    <button {...props}>{children}</button>
  ),
  LinkButton: ({ children, href, className }: React.PropsWithChildren<{ href: string; className?: string }>) => (
    <a href={href} className={className}>{children}</a>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('EnvironmentAwaitingPromotion', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onResume = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    onResume.mockClear();
  });

  afterEach(async () => act(async () => root.unmount()));

  it('shows the exact server candidate with one continue action at 1280px', async () => {
    await render();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain('environmentVersionAwaitingCandidate');
    expect(container.textContent).toContain('2.0.0');
    expect(container.textContent).toContain('environmentVersionManualRequired');
    expect(container.querySelector('a')?.getAttribute('href')).toContain('releaseRunId=release-1');
    await act(async () => container.querySelector('button')?.click());
    expect(onResume).toHaveBeenCalledWith({
      releaseRunId: 'release-1', deploymentRunId: 'deployment-1', candidateHash: 'a'.repeat(64),
    });
  });

  it('keeps both mobile actions on 44px wrapping targets at 390px', async () => {
    await render();
    expect(container.querySelectorAll('.min-h-11')).toHaveLength(2);
    expect(container.querySelector('.flex-wrap')).not.toBeNull();
  });

  async function render() {
    await act(async () => root.render(
      <EnvironmentAwaitingPromotion
        projectId="project-1"
        environment={environment()}
        candidate={candidate()}
        executing={false}
        onResume={onResume}
        onReconcile={vi.fn()}
      />,
    ));
  }
});

function environment(): EnvironmentVersionEnvironment {
  return {
    id: 'production-1', key: 'production', name: 'Production', baselineRole: 'production',
    currentEnvironmentVersionId: null,
    targetReadiness: {
      environmentId: 'production-1', environmentKey: 'production', expectedProviderKey: 'ssh-v1',
      bindingCount: 1, matchState: 'ready', reasonCode: 'TARGET_READY', remediation: null,
      currentTarget: null,
    },
    environmentVersions: [], releaseRuns: [{
      id: 'release-1', mode: 'production', status: 'awaiting_validation', artifactManifestId: 'manifest-1',
      legacyPromotionRecovery: null,
      deploymentRuns: [{
        id: 'deployment-1', status: 'awaiting_validation', createdAt: '2026-08-11T00:00:00Z',
        result: { productionCandidate: {
          candidateHash: 'a'.repeat(64), releaseOrderId: 'order-1', manifestId: 'manifest-1',
        } },
      }],
    }],
  };
}

function candidate() {
  return {
    id: 'manifest-1', digest: 'sha256:manifest', releaseOrder: { id: 'order-1', releaseVersion: '2.0.0' },
    buildRun: { id: 'build-1', revision: 1, sourceCommitSha: 'b'.repeat(40) },
    deploymentRuns: [], releaseRuns: [],
  } as EnvironmentVersionCandidate;
}
