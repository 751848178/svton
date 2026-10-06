// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import { ReleaseProductionCurrentRun } from './release-production-current-run';

vi.mock('next-intl', () => ({
  useLocale: () => 'zh',
  useTranslations: () => (key: string) => key,
}));
vi.mock('next/link', () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
vi.mock('@/components/ui', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('@svton/ui', () => ({
  Tabs: ({
    items,
  }: {
    items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }>;
  }) => (
    <div>
      {items.map((item) => (
        <section key={item.key}>
          {item.label}
          {item.children}
        </section>
      ))}
    </div>
  ),
}));

describe('ReleaseProductionCurrentRun', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders exact run, approval, deployment, failure and read-only recovery evidence', async () => {
    const onOpenLog = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ReleaseProductionCurrentRun
          run={run()}
          environmentHref="/environment"
          onOpenLog={onOpenLog}
        />,
      ),
    );
    const text = container.textContent || '';
    expect(container.querySelector('[title="release-run-1"]')).not.toBeNull();
    expect(text).toContain('approval-requester@example.com');
    expect(text).toContain('releaseProductionApprovalReadOnly');
    expect(container.querySelector('code[title="deployment-run-1"]')).not.toBeNull();
    expect(text).toContain('server-executor · docker-compose');
    expect(text).toContain('PRODUCTION_FAILED · target refused deploy');
    expect(text).toContain('P03 · evaluation-1');
    expect(text).toContain('releaseProductionRecoveryReadOnly');
    expect(text).not.toContain('releaseStageActionRetry');
    expect(text).not.toContain('rollbackAction');
    const logButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('viewProductionLogs'),
    )!;
    act(() => logButton.click());
    expect(onOpenLog).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });
});

function run(): ReleaseEvidenceProductionRun {
  return {
    id: 'release-run-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'environment-1',
    artifactManifestId: 'manifest-1',
    mode: 'standard',
    status: 'failed',
    verifiedDigest: 'sha256:digest',
    errorCode: 'PRODUCTION_FAILED',
    errorMessage: 'target refused deploy',
    startedAt: '2026-08-28T00:01:00Z',
    finishedAt: '2026-08-28T00:02:00Z',
    createdAt: '2026-08-28T00:00:00Z',
    environment: { id: 'environment-1', name: 'Production', baselineRole: 'production' },
    manifest: {
      id: 'manifest-1',
      digest: 'sha256:digest',
      createdAt: '2026-08-28T00:00:00Z',
      buildRun: { id: 'build-1', revision: 3, sourceBranch: 'main', sourceCommitSha: 'commit' },
      items: [],
    },
    operationApproval: {
      id: 'approval-1',
      status: 'pending',
      risk: 'high',
      summary: 'production request',
      requesterId: 'requester-1',
      reviewerId: null,
      requester: { id: 'requester-1', name: null, email: 'approval-requester@example.com' },
      reviewer: null,
      reviewComment: null,
      requestedAt: '2026-08-28T00:00:00Z',
      reviewedAt: null,
      consumedAt: null,
      expiresAt: null,
    },
    legacyPromotionRecovery: null,
    promotionBlocker: {
      commandId: 'command-1',
      errorCode: 'RELEASE_GATE_BLOCKED',
      errorMessage: 'manual',
      checkpoint: 'production',
      decisionId: 'decision-1',
      manualChecks: [
        {
          gateId: 'P03',
          evaluationId: 'evaluation-1',
          status: 'manual',
          reasonCode: 'manual',
          reason: { zh: '需要人工确认', en: 'Manual confirmation required' },
          confirmed: false,
        },
      ],
    },
    stagingProof: null,
    deploymentRuns: [
      {
        id: 'deployment-run-1',
        projectId: 'project-1',
        releaseOrderId: 'order-1',
        releaseRunId: 'release-run-1',
        environmentId: 'environment-1',
        artifactManifestId: 'manifest-1',
        source: 'release_order',
        targetType: 'release-artifact',
        dryRun: false,
        status: 'failed',
        executorKey: 'server-executor',
        adapterKey: 'docker-compose',
        branch: 'main',
        commitSha: 'commit',
        error: 'deploy failed',
        logs: [],
        result: {},
        startedAt: '2026-08-28T00:01:00Z',
        finishedAt: '2026-08-28T00:02:00Z',
        createdAt: '2026-08-28T00:00:00Z',
        environment: { id: 'environment-1', name: 'Production', baselineRole: 'production' },
        manifest: {} as ReleaseEvidenceProductionRun['manifest'],
        siteProbe: null,
        routeSwitch: null,
      },
    ],
  };
}
