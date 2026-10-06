// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentRun } from '../types/operations';
import { ProjectDeploymentRunDrawer } from './project-deployment-run-drawer';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  Drawer: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => <div role="dialog" aria-label={String(title)}>{children}</div>,
  Tabs: ({ items }: { items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }> }) => (
    <div>{items.map((item) => <section key={item.key}><h2>{item.label}</h2>{item.children}</section>)}</div>
  ),
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  ErrorBanner: ({ message }: { message: string }) => <p>{message}</p>,
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('../hooks/use-project-deployment-evidence', () => ({
  useProjectDeploymentEvidence: (_projectId: string, _runId: string, run: DeploymentRun) => ({
    run, streams: [], entries: [], audits: [], loading: false,
    error: '', logsError: '', auditError: '', reload: vi.fn(),
  }),
}));
vi.mock('./deployment-stage-timeline.component', () => ({ DeploymentStageTimeline: () => <p>stage-evidence</p> }));
vi.mock('./release-site-probe-evidence', () => ({ ReleaseSiteProbeEvidence: () => <p>probe-evidence</p> }));

describe('ProjectDeploymentRunDrawer', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders five independent evidence areas and no unsupported recovery action', async () => {
    await act(async () => {
      root.render(<ProjectDeploymentRunDrawer run={fixture()} projectId="project-1" onClose={() => undefined} />);
    });
    const text = container.textContent ?? '';
    for (const key of ['deploymentEvidenceOverview', 'deploymentEvidenceStages', 'deploymentEvidenceLogs',
      'deploymentEvidenceValidation', 'deploymentEvidenceRecoveryAudit']) {
      expect(text).toContain(key);
    }
    expect(text).toContain('deploymentEvidenceCapabilitiesUnavailable');
    const buttons = [...container.querySelectorAll('button')].map((button) => button.textContent);
    expect(buttons.some((label) => /retry|rollback|smoke/i.test(label ?? ''))).toBe(false);
  });
});

function fixture(): DeploymentRun {
  return {
    id: 'run-1', projectId: 'project-1', environment: 'staging', targetType: 'application',
    dryRun: false, source: 'manual', status: 'failed', branch: 'main', commitSha: null,
    commandPlan: null, logs: null, result: null, error: 'deploy failed',
    startedAt: '2026-08-27T00:00:00Z', finishedAt: '2026-08-27T00:01:00Z',
  };
}
