// @vitest-environment jsdom

/**
 * DEP-3 / DEP-5 回归：runId 聚焦条必须有完整运行标识 + 「清除聚焦」出口；
 * 部署记录必须有环境/状态/来源筛选与排序，且筛选状态写入 URL。
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeploymentPanel } from './deployment-panel';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  pathname: '/projects/project-1',
  replace: vi.fn(),
  runs: [] as Array<Record<string, unknown>>,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mocks.searchParams,
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@svton/ui', () => ({ EmptyState: () => <div>empty</div> }));
vi.mock('@/components/ui', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div role="status">{children}</div>,
  ErrorBanner: () => <div>error</div>,
  Select: ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children?: React.ReactNode;
  }) => <select {...props}>{children}</select>,
}));
vi.mock('./deployment-run-list', () => ({
  DeploymentRunList: (props: { runs: Array<{ id: string }> }) => (
    <div data-testid="run-list" data-count={props.runs.length}>
      {props.runs.map((run) => (
        <span key={run.id} data-testid="run-row">
          {run.id}
        </span>
      ))}
    </div>
  ),
}));
vi.mock('./panel-group', () => ({
  PanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('./deploy-service-section', () => ({ DeployServiceSection: () => null }));

function detail() {
  return {
    project: { id: 'project-1', applications: [] },
    deploymentRuns: mocks.runs,
    deploymentError: null,
    loadDeploymentRuns: vi.fn(),
  } as never;
}

function makeRun(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    environment: 'dev',
    status: 'succeeded',
    source: 'manual',
    targetType: 'server',
    dryRun: false,
    branch: null,
    commitSha: null,
    error: null,
    startedAt: '2026-08-10T10:00:00Z',
    finishedAt: null,
    ...overrides,
  };
}

describe('DeploymentPanel focus + filters (DEP-3/DEP-5)', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    mocks.searchParams = new URLSearchParams('view=deployments');
    mocks.replace.mockReset();
    mocks.runs = [
      makeRun('run-failed', { status: 'failed', environment: 'production', startedAt: '2026-08-11T10:00:00Z' }),
      makeRun('run-ok', { status: 'succeeded', environment: 'dev' }),
    ];
  });
  afterEach(async () => act(async () => root.unmount()));

  function render(focusedRunId?: string) {
    return act(async () => {
      root.render(<DeploymentPanel detail={detail()} focusedRunId={focusedRunId} />);
    });
  }

  function setSelectValue(select: HTMLSelectElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!
      .set!;
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('DEP-5: renders environment/status/source/sort filters derived from real runs', async () => {
    await render();
    const filters = container.querySelector('[data-testid="deployment-run-filters"]')!;
    expect(filters).not.toBeNull();
    const selects = [...filters.querySelectorAll('select')];
    expect(selects).toHaveLength(4);
    const statusSelect = selects.find((s) => s.getAttribute('aria-label') === 'deploymentRunFilterStatus')!;
    expect([...statusSelect.options].map((o) => o.value)).toEqual(['', 'failed', 'succeeded']);
    expect(container.querySelector('[data-testid="run-list"]')!.getAttribute('data-count')).toBe('2');
  });

  it('DEP-5: choosing a status filter syncs it into the URL and narrows the visible runs', async () => {
    mocks.searchParams = new URLSearchParams('view=deployments&runStatus=failed');
    await render();
    expect(container.querySelector('[data-testid="run-list"]')!.getAttribute('data-count')).toBe('1');
    expect(container.querySelector('[data-testid="run-row"]')!.textContent).toBe('run-failed');
    expect(container.textContent).toContain('deploymentRunFilterSummary');

    // 改变筛选 → 写回 URL（保留 view）
    const filters = container.querySelector('[data-testid="deployment-run-filters"]')!;
    const statusSelect = [...filters.querySelectorAll('select')].find(
      (s) => s.getAttribute('aria-label') === 'deploymentRunFilterStatus',
    )! as HTMLSelectElement;
    await act(async () => setSelectValue(statusSelect, ''));
    expect(mocks.replace).toHaveBeenCalledWith('/projects/project-1?view=deployments', {
      scroll: false,
    });
  });

  it('DEP-3: the focus bar shows the full run id and offers a clear-focus exit', async () => {
    mocks.searchParams = new URLSearchParams('view=deployments&runId=run-failed');
    await render('run-failed');
    const focusBar = container.querySelector('[role="status"]')!;
    // 完整运行标识上屏（不再只给截断 8 位）
    expect(focusBar.textContent).toContain('run-failed');
    const clearButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('focusedDeploymentRunClear'),
    )!;
    expect(clearButton).not.toBeNull();
    await act(async () => clearButton.click());
    expect(mocks.replace).toHaveBeenCalledWith('/projects/project-1?view=deployments', {
      scroll: false,
    });
  });
});
