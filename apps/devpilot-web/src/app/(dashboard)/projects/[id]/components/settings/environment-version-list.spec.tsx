// @vitest-environment jsdom

/**
 * SET-1/SET-2/SET-4/SET-14 focused spec：已有版本表格行操作必须有可见反馈，
 * 且 1280px 下不出现列叠印（jsdom 无真实布局，以列结构切换类做 DOM 断言替代）。
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
} from '../../types/environment-version.types';
import { EnvironmentVersionList } from './environment-version-list';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

function buildCandidate(overrides: Partial<EnvironmentVersionCandidate> = {}) {
  return {
    id: 'manifest-1',
    digest: 'a'.repeat(64),
    createdAt: '2026-08-10T10:07:00Z',
    releaseOrder: { id: 'ro-1', releaseName: '首个稳定版', releaseVersion: '0.0.1' },
    buildRun: {
      id: 'build-1',
      revision: 10,
      sourceBranch: 'master',
      sourceCommitSha: '8e7c465d1122',
    },
    deploymentRuns: [{ id: 'deploy-1' }],
    releaseRuns: [
      {
        id: 'release-run-1',
        operationApproval: { id: 'appr-1', status: 'approved', consumedAt: null },
      },
    ],
    ...overrides,
  } satisfies EnvironmentVersionCandidate;
}

function buildEnvironment() {
  return {
    id: 'env-1',
    key: 'production',
    name: '生产',
    baselineRole: 'production',
    currentEnvironmentVersionId: null,
    targetReadiness: {
      environmentId: 'env-1',
      environmentKey: 'production',
      expectedProviderKey: 'ssh-v1',
      bindingCount: 1,
      matchState: 'ready',
      reasonCode: 'TARGET_READY',
      remediation: null,
      currentTarget: null,
    },
    environmentVersions: [],
  } satisfies EnvironmentVersionEnvironment;
}

describe('EnvironmentVersionList row actions (SET-1/2/4)', () => {
  let root: Root;
  let container: HTMLDivElement;
  const onSelect = vi.fn();
  const onSwitch = vi.fn();

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onSelect.mockReset();
    onSwitch.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  async function renderList(candidates: EnvironmentVersionCandidate[] = [buildCandidate()]) {
    await act(async () => {
      root.render(
        <EnvironmentVersionList
          environment={buildEnvironment()}
          candidates={candidates}
          executing={false}
          onSelect={onSelect}
          onSwitch={onSwitch}
        />,
      );
    });
  }

  function actionButton(label: string) {
    const button = [...container.querySelectorAll('button')].find((item) =>
      item.textContent?.includes(label),
    );
    expect(button, `action button ${label}`).toBeTruthy();
    return button!;
  }

  it('SET-1: 查看详情 opens an inline detail expansion instead of a silent selection change', async () => {
    await renderList();
    await act(async () => {
      actionButton('viewVersionDetails').click();
    });
    const panelRow = container.querySelector('tbody tr:nth-child(2) td[colspan="6"]');
    expect(panelRow).not.toBeNull();
    expect(panelRow!.textContent).toContain('environmentVersionDetailPanelTitle');
    expect(panelRow!.textContent).toContain('0.0.1');
    expect(panelRow!.textContent).toContain('首个稳定版');
    expect(panelRow!.textContent).toContain('master @ 8e7c465d');
    expect(panelRow!.textContent).toContain('R10');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('SET-2: 查看变更 shows the change source and an explicit no-detail note', async () => {
    await renderList();
    await act(async () => {
      actionButton('viewVersionChanges').click();
    });
    const panelRow = container.querySelector('tbody tr:nth-child(2) td[colspan="6"]');
    expect(panelRow).not.toBeNull();
    expect(panelRow!.textContent).toContain('environmentVersionChangesPanelTitle');
    expect(panelRow!.textContent).toContain('master @ 8e7c465d');
    expect(panelRow!.textContent).toContain('environmentVersionChangesNoDetail');
  });

  it('SET-4: 技术证据 overflow menu item opens the evidence panel with collapsed technical ids', async () => {
    await renderList();
    const moreTrigger = container.querySelector<HTMLButtonElement>(
      'button[aria-haspopup="menu"]',
    )!;
    expect(moreTrigger).toBeTruthy();
    await act(async () => {
      moreTrigger.click();
    });
    const menuItem = [...document.body.querySelectorAll('[role="menuitem"]')].find((item) =>
      item.textContent?.includes('releaseOrderActionEvidence'),
    );
    expect(menuItem).toBeTruthy();
    await act(async () => {
      menuItem!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const panelRow = container.querySelector('tbody tr:nth-child(2) td[colspan="6"]');
    expect(panelRow).not.toBeNull();
    expect(panelRow!.textContent).toContain('environmentVersionEvidencePanelTitle');
    expect(panelRow!.textContent).toContain('environmentVersionTechnicalIds');
    // 技术证据 ID 在折叠区内保留可追溯，而不是消失或占据主列。
    expect(panelRow!.textContent).toContain('release-run-1');
    expect(panelRow!.textContent).toContain('deploy-1');
  });

  it('clicking the same action twice collapses the panel', async () => {
    await renderList();
    await act(async () => {
      actionButton('viewVersionDetails').click();
    });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    await act(async () => {
      actionButton('viewVersionDetails').click();
    });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('each row expands independently', async () => {
    await renderList([
      buildCandidate(),
      buildCandidate({
        id: 'manifest-2',
        releaseOrder: { id: 'ro-2', releaseName: '图库重构', releaseVersion: '1.4.0' },
      }),
    ]);
    const buttons = [...container.querySelectorAll('button')].filter((item) =>
      item.textContent?.includes('viewVersionDetails'),
    );
    expect(buttons).toHaveLength(2);
    await act(async () => {
      buttons[1].click();
    });
    const panel = container.querySelector('td[colspan="6"]');
    expect(panel!.textContent).toContain('1.4.0');
    expect(panel!.textContent).toContain('图库重构');
  });

  it('SET-14: 1280px structure — merged version column, evidence column hidden below 2xl, truncating cells', async () => {
    await renderList();
    const headers = container.querySelectorAll('thead th');
    expect(headers).toHaveLength(6);
    const evidenceHeader = headers[2];
    // jsdom 无真实布局：以 Tailwind 列结构断言替代 getBoundingClientRect 重叠检测。
    // 2xl(1536px) 以下隐藏发布证据列，1280px 内容区不再与操作列叠印。
    expect(evidenceHeader.className).toContain('hidden');
    expect(evidenceHeader.className).toContain('2xl:table-cell');
    const table = container.querySelector('table')!;
    expect(table.className).toContain('min-w-[640px]');
    const bodyRows = container.querySelectorAll('tbody tr');
    const cells = bodyRows[0].querySelectorAll('td');
    expect(cells[0].querySelector('p')!.className).toContain('truncate');
    expect(cells[1].querySelector('p')!.className).toContain('truncate');
    expect(cells[3].className).toContain('whitespace-nowrap');
    const evidenceCell = cells[2];
    expect(evidenceCell.className).toContain('hidden');
    expect(evidenceCell.className).toContain('2xl:table-cell');
  });
});

describe('EnvironmentVersionList switch disabled reason (SET-3)', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
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
    document.body.innerHTML = '';
  });

  it('shows why switching is disabled for an unapproved production version', async () => {
    const unapproved = buildCandidate({
      releaseRuns: [] as EnvironmentVersionCandidate['releaseRuns'],
    });
    await act(async () => {
      root.render(
        <EnvironmentVersionList
          environment={buildEnvironment()}
          candidates={[unapproved]}
          executing={false}
          onSelect={() => undefined}
          onSwitch={() => undefined}
        />,
      );
    });
    // production 且无已审批运行 → blocked，必须给出文字原因
    expect(container.textContent).toContain('envVersionSwitchDisabledApproval');
  });

  it('shows the active-version reason when the candidate is already current', async () => {
    const candidate = buildCandidate();
    await act(async () => {
      root.render(
        <EnvironmentVersionList
          environment={buildEnvironment()}
          candidates={[candidate]}
          current={
            {
              artifactManifestId: candidate.id,
              artifactManifest: { buildRun: candidate.buildRun },
              releaseOrder: candidate.releaseOrder,
            } as never
          }
          executing={false}
          onSelect={() => undefined}
          onSwitch={() => undefined}
        />,
      );
    });
    expect(container.textContent).toContain('envVersionSwitchDisabledActive');
  });
});
