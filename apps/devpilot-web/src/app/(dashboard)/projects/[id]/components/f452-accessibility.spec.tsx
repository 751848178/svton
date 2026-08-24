// @vitest-environment jsdom

/**
 * F452 accessibility — focused specs for the new aria/focus behavior and axe assertions.
 *
 * Covers AC-A11Y-002..007, AC-A11Y-012 on the components changed by F452:
 * Drawer Tab trap + localized close label, Modal ariaCloseLabel, LoadingState role=status,
 * ErrorBanner role=alert, intake stepper list semantics, env settings tablist + labeled
 * change-summary input, table scope=col/row, plus axe (zero critical/serious violations).
 */

import React, { act, useEffect, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { Drawer, LoadingState, Modal } from '@svton/ui';
import { ErrorBanner } from '@/components/ui/error-banner';
import { ProjectIntakeStepper } from '../../create/components/project-intake-stepper';
import type { ProjectEnvironment } from '../types';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import type { ReleaseOrderStep } from '../types/release-order.types';
import type { ReleaseWorkbenchStepView } from './release-workbench/release-workbench-steps.model';
import { ReleaseWorkbenchSteps } from './release-workbench/release-workbench-steps';
import { EnvironmentSettingsDetail } from './settings/environment-settings-detail';
import { ReleaseBuildHistoryTable } from './release-build-history-table';
import { ReleaseStagingEvidenceList } from './release-staging-evidence-list';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => unknown;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
  LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock('@/components/ui/feedback/feedback', () => ({
  feedback: { success: vi.fn(), error: vi.fn() },
}));

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
  governance: {
    current: null,
    policies: [],
    data: { revisions: [] },
    loading: false,
    saving: false,
    error: '',
    save: vi.fn(),
    load: vi.fn(),
  },
  targets: { data: { currentTarget: null }, error: '', loading: false },
}));

vi.mock('next/navigation', () => {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    useRouter: () => ({
      replace: (href: string) => {
        const query = href.includes('?') ? href.split('?')[1] : '';
        mocks.searchParams = new URLSearchParams(query);
        mocks.replace(href);
        notify();
      },
    }),
    useSearchParams: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        () => mocks.searchParams,
      ),
  };
});
vi.mock('../../hooks/use-environment-config-governance', () => ({
  useEnvironmentConfigGovernance: () => mocks.governance,
}));
vi.mock('../../hooks/use-environment-deployment-targets', () => ({
  useEnvironmentDeploymentTargets: () => mocks.targets,
}));
vi.mock('./settings/settings-env-tab-switch', () => ({
  renderEnvTab: (tab: string) => <div data-env-tab={tab}>env-tab-content:{tab}</div>,
}));
vi.mock('./settings/environment-settings-summary', () => ({
  EnvironmentSettingsSummary: () => <div>env-summary</div>,
}));

describe('F452 Drawer focus trap + localized close label', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderDrawer() {
    await act(async () => {
      root.render(
        <Drawer
          open
          onClose={vi.fn()}
          title="Build logs"
          ariaCloseLabel="关闭"
        >
          <button type="button">first action</button>
          <button type="button">second action</button>
        </Drawer>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  it('renders a dialog with a localized close button name', async () => {
    await renderDrawer();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
    expect(dialog).not.toBeNull();
    // 命名模型：标题经 aria-labelledby 关联（不再把 title 复制进 aria-label）。
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    const titleEl = labelledBy ? document.getElementById(labelledBy) : null;
    expect(titleEl?.textContent).toBe('Build logs');
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="关闭"]');
    expect(close).not.toBeNull();
  });

  it('traps Tab within the drawer panel in both directions', async () => {
    await renderDrawer();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const buttons = dialog ? [...dialog.querySelectorAll<HTMLButtonElement>('button')] : [];
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    act(() => last.focus());
    await act(async () => {
      last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(first);

    act(() => first.focus());
    await act(async () => {
      first.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
      );
    });
    expect(document.activeElement).toBe(last);
  });
});

describe('F452 Modal localized close label + LoadingState/ErrorBanner live regions', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('Modal close button uses the localized ariaCloseLabel', async () => {
    await act(async () => {
      root.render(
        <Modal
          open
          onClose={vi.fn()}
          title="确认"
          ariaCloseLabel="关闭对话框"
        >
          <button type="button">ok</button>
        </Modal>,
      );
    });
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="关闭对话框"]');
    expect(close).not.toBeNull();
  });

  it('LoadingState exposes role=status and ErrorBanner role=alert', async () => {
    await act(async () => {
      root.render(
        <div>
          <LoadingState text="加载中" />
          <ErrorBanner message="出错了" />
        </div>,
      );
    });
    expect(document.querySelector('[role="status"]')?.textContent).toContain('加载中');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('出错了');
  });
});

describe('F452 intake stepper semantics', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('marks up steps as an ordered list with aria-current=step', async () => {
    await act(async () => {
      root.render(<ProjectIntakeStepper step={2} />);
    });
    const list = document.querySelector('nav[aria-label="intakeSteps"] ol');
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll('li')).toHaveLength(3);
    const current = list?.querySelector('li[aria-current="step"]');
    expect(current?.textContent).toContain('intakeStepReview');
  });
});

describe('F452 table scope=col/row', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('build history headers carry scope=col', async () => {
    await act(async () => {
      root.render(
        <ReleaseBuildHistoryTable
          items={[build({ id: 'build-success', status: 'succeeded' })]}
          onOpenLog={vi.fn()}
        />,
      );
    });
    const headers = container.querySelectorAll('thead th');
    expect(headers.length).toBeGreaterThan(0);
    for (const th of headers) expect(th.getAttribute('scope')).toBe('col');
  });

  it('staging evidence headers carry scope=col and row headers scope=row', async () => {
    await act(async () => {
      root.render(
        <ReleaseStagingEvidenceList
          items={[stagingItem()]}
          builds={[build({ id: 'build-1' })]}
          total={1}
          deploying={false}
          onOpenLog={vi.fn()}
          onDeploy={vi.fn()}
        />,
      );
    });
    const headers = container.querySelectorAll('thead th');
    expect(headers.length).toBeGreaterThan(0);
    for (const th of headers) expect(th.getAttribute('scope')).toBe('col');
    expect(container.querySelectorAll('tbody th[scope="row"]').length).toBeGreaterThan(0);
  });
});

describe('F452 env settings tablist + labeled change-summary input', () => {
  let root: Root;
  let container: HTMLDivElement;

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

  async function renderSettings() {
    await act(async () => {
      root.render(
        <EnvironmentSettingsDetail
          detail={detailStub()}
          environment={environmentStub()}
        />,
      );
    });
  }

  it('exposes a tablist with selected tab, roving tabindex and a linked panel', async () => {
    await renderSettings();
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.length).toBeGreaterThanOrEqual(5);
    const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(selected).toBeDefined();
    expect(selected?.getAttribute('aria-current')).toBeNull();
    expect(selected?.tabIndex).toBe(0);
    for (const tab of tabs.filter((tab) => tab !== selected)) {
      expect(tab.tabIndex).toBe(-1);
    }
    const panel = container.querySelector<HTMLElement>('[role="tabpanel"]');
    expect(panel?.getAttribute('aria-labelledby')).toBe(selected?.id);
  });

  it('moves selection and focus with arrow keys and Home/End', async () => {
    await renderSettings();
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const first = tabs[0];
    act(() => first.focus());
    const dispatch = (target: HTMLButtonElement, key: string) => {
      act(() => {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    };
    dispatch(first, 'ArrowRight');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].tabIndex).toBe(0);
    expect(document.activeElement).toBe(tabs[1]);
    dispatch(tabs[1], 'Home');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[0]);
    dispatch(tabs[0], 'End');
    expect(tabs[tabs.length - 1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[tabs.length - 1]);
  });

  it('labels the change-summary input with a programmatic label', async () => {
    await renderSettings();
    const input = container.querySelector<HTMLInputElement>('input[placeholder="configChangeSummary"]');
    expect(input).not.toBeNull();
    const label = container.querySelector<HTMLLabelElement>(`label[for="${input?.id}"]`);
    expect(label).not.toBeNull();
    expect(label?.textContent).toBe('configChangeSummary');
  });
});

describe('F452 axe assertions on key components', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(node: React.ReactNode) {
    await act(async () => root.render(node));
  }

  async function expectNoCriticalOrSerious(context: Element) {
    const result = await axe.run(context, {
      resultTypes: ['violations'],
    });
    const bad = result.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(bad).toEqual([]);
  }

  it('steps bar: zero critical/serious violations and inline tab semantics', async () => {
    await render(
      <ReleaseWorkbenchSteps
        views={steps}
        selectedStep="build"
        onSelectStep={vi.fn()}
        onPublish={vi.fn()}
        publishing={false}
        publishDisabled={false}
      >
        <p>current round</p>
      </ReleaseWorkbenchSteps>,
    );
    await expectNoCriticalOrSerious(container);
    const tabs = container.querySelectorAll('nav[role="tablist"] button[data-step]');
    expect(tabs.length).toBe(3);
    for (const tab of tabs) {
      expect(tab.getAttribute('aria-selected')).not.toBeNull();
      expect(tab.getAttribute('aria-controls')).not.toBeNull();
    }
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toContain('current round');
    const publish = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('releaseWorkbenchPublishAction'),
    );
    expect(publish).toBeDefined();
  });

  it('intake stepper: zero critical/serious violations', async () => {
    await render(<ProjectIntakeStepper step={1} />);
    await expectNoCriticalOrSerious(container);
  });

  it('error banner + loading state: zero critical/serious violations', async () => {
    await render(
      <div>
        <LoadingState text="Loading" />
        <ErrorBanner message="Something failed" />
      </div>,
    );
    await expectNoCriticalOrSerious(container);
  });

  it('build + staging tables: zero critical/serious violations', async () => {
    await render(
      <div>
        <ReleaseBuildHistoryTable
          items={[build({ id: 'build-success', status: 'succeeded' })]}
          onOpenLog={vi.fn()}
        />
        <ReleaseStagingEvidenceList
          items={[stagingItem()]}
          builds={[build({ id: 'build-1' })]}
          total={1}
          deploying={false}
          onOpenLog={vi.fn()}
          onDeploy={vi.fn()}
        />
      </div>,
    );
    await expectNoCriticalOrSerious(container);
  });

  it('drawer dialog: zero critical/serious violations', async () => {
    await render(
      <Drawer
        open
        onClose={vi.fn()}
        title="Logs"
        ariaCloseLabel="关闭"
      >
        <button type="button">a</button>
        <button type="button">b</button>
      </Drawer>,
    );
    await expectNoCriticalOrSerious(document.body);
  });
});

const steps: ReleaseWorkbenchStepView[] = [
  view('preflight', 1, 'completed', false),
  view('build', 2, 'blocked', false),
  view('staging', 3, 'current', true),
];

function view(
  key: ReleaseWorkbenchStepView['key'],
  number: number,
  state: ReleaseWorkbenchStepView['state'],
  isCurrent: boolean,
): ReleaseWorkbenchStepView {
  return {
    key,
    number,
    state,
    isCurrent,
    labelKey: `releaseWorkbenchStep${titleCase(key === 'staging' ? 'deploy' : key)}` as ReleaseWorkbenchStepView['labelKey'],
    stateLabelKey:
      state === 'blocked'
        ? 'releaseOrderFailureBlocked'
        : (`releaseStepState${titleCase(state)}` as ReleaseWorkbenchStepView['stateLabelKey']),
  };
}

function titleCase(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function detailStub() {
  return {
    project: { id: 'project-1', environments: [] },
    loadProject: vi.fn(),
  } as unknown as Parameters<typeof EnvironmentSettingsDetail>[0]['detail'];
}

function environmentStub(): ProjectEnvironment {
  return {
    id: 'env-1',
    key: 'staging',
    name: 'Staging',
    baselineRole: 'staging',
    status: 'active',
    _count: { deploymentRuns: 0 },
  } as unknown as ProjectEnvironment;
}

function build(overrides: Partial<ReleaseBuildItem>): ReleaseBuildItem {
  return {
    id: 'build-1',
    releaseOrderId: 'order-1',
    revision: 1,
    sourceBranch: 'main',
    sourceCommitSha: 'a'.repeat(40),
    sourceRepository: null,
    status: 'running',
    logReference: 'build-log://build-1',
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-08-06T00:00:00.000Z',
    manifest: null,
    ...overrides,
  };
}

function stagingItem(): ReleaseStagingDeploymentItem {
  return {
    id: 'run-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environment: { id: 'env-1', key: 'staging', baselineRole: 'staging', name: 'Staging' },
    artifactManifestId: 'manifest-1',
    adapterKey: 'docker',
    executorKey: 'host',
    status: 'succeeded',
    error: null,
    startedAt: '2026-08-06T00:00:00.000Z',
    finishedAt: '2026-08-06T00:01:00.000Z',
    createdAt: '2026-08-06T00:00:00.000Z',
    verification: { conclusion: 'passed' },
    siteProbe: null,
    routeSwitch: null,
  } as unknown as ReleaseStagingDeploymentItem;
}
