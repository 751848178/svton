// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderEvidence } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { ReleaseWorkbenchHeader } from './release-workbench-header';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('/')}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('ReleaseWorkbenchHeader', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders the alert slot directly below the title and before basic facts', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ReleaseWorkbenchHeader
          detail={{ ...detail, note: 'Candidate release' }}
          projectSummary={summary}
          evidence={evidence}
          alert={<div data-alert-slot>decision</div>}
          onBack={vi.fn()}
        />,
      ),
    );
    const alert = container.querySelector('[data-alert-slot]');
    const header = container.querySelector('header')!;
    expect(alert).not.toBeNull();
    // 预警条是 header 的第二个子节点：标题行之后、基本信息（note/facts）之前。
    expect(header.children[1]).toBe(alert);
    // PX-17：页面标题为 H1（不再跳级）。
    expect(container.querySelector('h1')!.compareDocumentPosition(alert!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    await act(async () => root.unmount());
  });

  it('keeps basic facts left-aligned when the note is absent (no empty flex filler)', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <ReleaseWorkbenchHeader
          detail={{ ...detail, note: '' }}
          projectSummary={summary}
          evidence={evidence}
          onBack={vi.fn()}
        />,
      ),
    );
    // 无 note 时不渲染左侧占位容器：事实网格是 header 的直接子节点，
    // 单一 flex 子项在 justify-between 下自然左对齐。
    const header = container.querySelector('header')!;
    const flexRows = header.querySelectorAll(':scope > .flex');
    expect(flexRows.length).toBe(1); // 仅标题行
    expect(header.textContent).toContain('2.4.0');
    // PX-29：meta 行去掉与标题徽章重复的「真实执行阶段」，状态徽章仍表达阶段。
    expect(header.textContent).toContain('releaseOrderStatusStaging');
    expect(header.textContent).not.toContain('releaseWorkbenchCurrentStage');
    expect(container.querySelector('button')).not.toBeNull();
    await act(async () => root.unmount());
  });
});

const detail = {
  id: 'order-full-identifier',
  projectId: 'project-1',
  releaseName: 'Stable candidate',
  releaseVersion: '2.4.0',
  note: 'Candidate release',
  counts: { buildRuns: 1, manifests: 1, releaseRuns: 0 },
  lifecycle: { status: 'staging', phase: 'staging' },
  resumeStep: 'staging',
  preflight: { repository: { branch: 'main' } },
} as unknown as ReleaseOrderDetail;

const summary = {
  project: { id: 'project-1', name: 'Project Alpha' },
  currentVersions: {
    staging: { releaseVersion: '2.3.9' },
    production: { releaseVersion: '2.3.8' },
  },
} as unknown as ProjectDeliverySummary;

const evidence = {
  buildRuns: {
    items: [
      {
        id: 'build-1',
        sourceBranch: 'main',
        sourceCommitSha: '1234567890abcdef',
        createdAt: '2026-08-20T01:00:00.000Z',
        status: 'succeeded',
        manifest: {
          id: 'manifest-full-identifier',
          digest: 'sha256:full-digest',
          createdAt: '2026-08-20T01:00:00.000Z',
          buildRun: {
            id: 'build-1',
            revision: 1,
            sourceBranch: 'main',
            sourceCommitSha: '1234567890abcdef',
          },
          items: [],
        },
      },
    ],
  },
  stagingDeploymentRuns: { items: [] },
  productionReleaseRuns: { items: [] },
} as unknown as ReleaseOrderEvidence;
