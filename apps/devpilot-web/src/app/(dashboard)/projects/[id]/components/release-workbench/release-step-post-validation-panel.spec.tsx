// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';
import { ReleaseStepPostValidationPanel } from './release-step-post-validation-panel';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('@svton/ui', () => ({
  Drawer: ({
    open,
    onClose,
    children,
  }: React.PropsWithChildren<{
    open: boolean;
    onClose: () => void;
  }>) =>
    open ? (
      <aside role="dialog">
        <button
          aria-label="close drawer"
          onClick={onClose}
        >
          close
        </button>
        {children}
      </aside>
    ) : null,
}));

describe('ReleaseStepPostValidationPanel', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.requestAnimationFrame = (callback) => {
      callback(0);
      return 1;
    };
  });

  it('shows exact sources and opens a dedicated evidence drawer with focus return', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(<ReleaseStepPostValidationPanel lifecycleEvidence={evidence()} />),
    );
    const text = container.textContent || '';
    expect(container.querySelector('[title="release-run-1"]')).not.toBeNull();
    expect(container.querySelector('[title="deployment-run-1"]')).not.toBeNull();
    expect(text).toContain('ProjectDeliverySummary.currentVersions.production');
    expect(text).toContain('DeploymentRun.siteProbe.dns/tls/http');
    const trigger = container.querySelector(
      '#post-validation-evidence-trigger',
    ) as HTMLButtonElement;
    act(() => trigger.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('site.example.com');
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('route-target');
    const close = container.querySelector('[aria-label="close drawer"]') as HTMLButtonElement;
    act(() => close.click());
    expect(document.activeElement).toBe(trigger);
    await act(async () => root.unmount());
    container.remove();
  });
});

function evidence(): ReleaseLifecycleEvidence {
  const checks = [
    ['artifactIntegrity', 'ReleaseRun.verifiedDigest + DeploymentRun.manifest'],
    ['environmentVersion', 'ProjectDeliverySummary.currentVersions.production'],
    ['workloadReady', 'DeploymentRun.result.workloadReady'],
    ['healthProbe', 'DeploymentRun.result.healthProbe'],
    ['entryProbe', 'DeploymentRun.siteProbe.dns/tls/http'],
    ['routeSwitch', 'DeploymentRun.routeSwitch'],
  ].map(([key, source]) => ({
    key,
    source,
    status: 'passed',
    label: 'passed',
    tone: 'success',
    checkedAt: null,
  }));
  return {
    staging: 'passed',
    stagingProof: null,
    production: 'passed',
    validation: 'passed',
    completed: false,
    validationChecks: checks,
    productionRun: {
      id: 'release-run-1',
      manifest: { id: 'manifest-1', digest: 'sha256:digest' },
    },
    currentProductionVersion: {
      id: 'version-1',
      releaseOrderId: 'order-1',
      releaseVersion: '1.0.0',
      artifactManifestId: 'manifest-1',
      manifestDigest: 'sha256:digest',
      deploymentRunId: 'deployment-run-1',
      effectiveAt: '2026-08-28T00:00:00Z',
    },
    productionDeployment: {
      id: 'deployment-run-1',
      result: { workloadReady: { status: 'passed' } },
      siteProbe: {
        primaryDomain: 'site.example.com',
        finalUrl: 'https://site.example.com',
        probedAt: '2026-08-28T00:00:00Z',
        dns: { status: 'passed', error: null },
        tls: { status: 'passed', error: null },
        http: {
          status: 'passed',
          error: null,
          statusCode: 200,
          finalUrl: 'https://site.example.com',
        },
      },
      routeSwitch: { status: 'switched', targetRef: 'route-target' },
    },
  } as unknown as ReleaseLifecycleEvidence;
}
