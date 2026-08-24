// @vitest-environment jsdom

/** DEP-4 回归：「最近一次部署失败」banner 只在视口确实呈现最近一次运行时出现。 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeploymentsTab } from './deployments-tab';

const mocks = vi.hoisted(() => ({
  panel: vi.fn(),
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
}));
vi.mock('../deployment-panel', () => ({
  DeploymentPanel: () => {
    mocks.panel();
    return <div>deployment-panel</div>;
  },
}));

function detail(overrides: Record<string, unknown> = {}) {
  return {
    project: {
      applications: [
        { services: [{ status: 'active' }] },
      ],
    },
    deploymentRuns: [],
    ...overrides,
  } as never;
}

describe('DeploymentsTab latest-failed banner (DEP-4)', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });
  afterEach(async () => act(async () => root.unmount()));

  it('shows the banner when the latest run failed and no focus is active', async () => {
    await act(async () =>
      root.render(
        <DeploymentsTab
          detail={detail({ deploymentRuns: [{ id: 'r1', status: 'failed' }] })}
        />,
      ),
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'deploymentLatestFailedBanner',
    );
  });

  it('hides the banner while focused on an older run even if that run failed', async () => {
    await act(async () =>
      root.render(
        <DeploymentsTab
          detail={detail({
            deploymentRuns: [
              { id: 'latest', status: 'succeeded' },
              { id: 'older-failed', status: 'failed' },
            ],
          })}
          focusedRunId="older-failed"
        />,
      ),
    );
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps the banner when the focused run IS the latest failed run', async () => {
    await act(async () =>
      root.render(
        <DeploymentsTab
          detail={detail({ deploymentRuns: [{ id: 'latest', status: 'failed' }] })}
          focusedRunId="latest"
        />,
      ),
    );
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
