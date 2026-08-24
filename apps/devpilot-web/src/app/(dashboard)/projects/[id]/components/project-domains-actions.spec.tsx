// @vitest-environment jsdom

/**
 * DOM-3/DOM-4 focused spec：域名入口表格行操作必须有真实反馈。
 * - DOM-3 预览配置：点击打开配置预览弹层（计划加载中/有数据/无数据三种反馈）。
 * - DOM-4 删除：点击弹出二次确认弹窗，确认才触发删除动作。
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Site, SiteSyncPlan } from '@/app/(dashboard)/sites/types';
import { ProjectDomainsConfigPreview } from './project-domains-config-preview';
import { ProjectDomainsTable } from './project-domains-table';
import { ProjectDomainsRoute } from './project-domains-route';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'project-1' }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>();
  return {
    ...actual,
    StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  };
});

vi.mock('../hooks/use-project-detail', () => ({
  useProjectDetail: () => ({
    loading: false,
    error: '',
    project: {
      id: 'project-1',
      name: 'Picshare',
      gitRepo: 'git@example:picshare.git',
      applications: [{ defaultBranch: 'main' }],
      environments: [{ id: 'env-dev', key: 'dev', name: '开发', status: 'active' }],
    },
    loadProject: vi.fn(),
  }),
}));

const siteFixture: Site = {
  id: 'site-1',
  name: '用户端入口',
  primaryDomain: 'app.picshare.example',
  aliases: [],
  runtimeType: 'reverse_proxy',
  runtimeConfig: {},
  tls: { enabled: true },
  accessPolicy: {},
  status: 'active',
  lastSyncAt: null,
  syncError: null,
  createdAt: '2026-08-01T00:00:00Z',
  environment: { id: 'env-dev', key: 'dev', name: '开发', status: 'active' },
  server: { id: 'server-1', name: 'deploy-1', host: '10.0.0.1', status: 'online' },
};

const sitesHook = vi.hoisted(() => ({
  confirmDelete: vi.fn(),
  handleCreatePlan: vi.fn(),
}));

vi.mock('@/app/(dashboard)/sites/hooks/use-sites', () => {
  const React = require('react');
  return {
    useSites: () => {
      const [deleteTarget, setDeleteTarget] = React.useState(null as Site | null);
      return {
        sites: [siteFixture],
        servers: [],
        projects: [],
        projectEnvironments: [],
        proxyConfigs: [],
        plans: {},
        syncRuns: {},
        loading: false,
        error: '',
        deleteTarget,
        showModal: false,
        editTarget: null,
        planningId: null,
        setShowModal: vi.fn(),
        setEditTarget: vi.fn(),
        handleDelete: (id: string) => {
          // 与真实 hook 契约一致：按 id 选中待确认目标，打开二次确认。
          if (id === siteFixture.id) setDeleteTarget(siteFixture);
        },
        cancelDelete: () => setDeleteTarget(null),
        confirmDelete: sitesHook.confirmDelete,
        handleCreatePlan: sitesHook.handleCreatePlan,
        reload: vi.fn(),
      };
    },
  };
});

vi.mock('@/app/(dashboard)/sites/components/add-site-modal', () => ({ AddSiteModal: () => null }));
vi.mock('@/app/(dashboard)/sites/components/edit-site-modal', () => ({
  EditSiteModal: () => null,
}));
vi.mock('./project-workbench-header', () => ({
  ProjectWorkbenchHeader: () => <div data-testid="workbench-header" />,
}));
vi.mock('./project-context-issue', () => ({ ProjectContextIssue: () => null }));

describe('ProjectDomainsTable row actions (DOM-3/DOM-4)', () => {
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

  function rowButton(label: string) {
    const button = [...container.querySelectorAll('button')].find((item) =>
      item.textContent?.includes(label),
    );
    expect(button, `row button ${label}`).toBeTruthy();
    return button!;
  }

  it('DOM-3: 预览配置 emits onPlan with the row id and shows a loading label while planning', async () => {
    const onPlan = vi.fn();
    await act(async () => {
      root.render(
        <ProjectDomainsTable
          items={[siteFixture]}
          onEdit={vi.fn()}
          onPlan={onPlan}
          onDelete={vi.fn()}
          planningSiteId={null}
        />,
      );
    });
    await act(async () => {
      rowButton('domainActionPreview').click();
    });
    expect(onPlan).toHaveBeenCalledWith('site-1');

    await act(async () => {
      root.render(
        <ProjectDomainsTable
          items={[siteFixture]}
          onEdit={vi.fn()}
          onPlan={onPlan}
          onDelete={vi.fn()}
          planningSiteId="site-1"
        />,
      );
    });
    const loadingButton = rowButton('domainActionPreviewLoading');
    expect(loadingButton.disabled).toBe(true);
  });

  it('DOM-3: preview modal shows explicit feedback for loading, data, and empty states', async () => {
    await act(async () => {
      root.render(
        <ProjectDomainsConfigPreview
          open
          site={siteFixture}
          loading
          onClose={vi.fn()}
        />,
      );
    });
    expect(document.body.textContent).toContain('domainConfigPreviewLoading');

    const plan = {
      mode: 'sync',
      status: 'planned',
      executorKey: 'openresty',
      adapterKey: 'ssh',
      executable: true,
      warnings: ['upstream unreachable'],
      commandPlan: [],
      nginxConfig: 'server { server_name app.picshare.example; }',
      target: { configPath: '/etc/openresty/conf.d/app.conf' },
      configDiff: {
        hasBaseline: true,
        hasChanges: true,
        added: 2,
        removed: 0,
        unchanged: 8,
        summary: '+2 -0',
        unifiedDiff: '',
      },
    } as unknown as SiteSyncPlan;
    await act(async () => {
      root.render(
        <ProjectDomainsConfigPreview
          open
          site={siteFixture}
          plan={plan}
          loading={false}
          onClose={vi.fn()}
        />,
      );
    });
    const body = document.body.textContent ?? '';
    expect(body).toContain('/etc/openresty/conf.d/app.conf');
    expect(body).toContain('upstream unreachable');
    expect(body).toContain('server_name app.picshare.example');
    expect(body).toContain('domainConfigPreviewDiffSummary');

    await act(async () => {
      root.render(
        <ProjectDomainsConfigPreview
          open
          site={siteFixture}
          loading={false}
          onClose={vi.fn()}
        />,
      );
    });
    expect(document.body.textContent).toContain('domainConfigPreviewEmpty');
  });
});

describe('ProjectDomainsRoute delete flow (DOM-4)', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    sitesHook.confirmDelete.mockClear();
    sitesHook.handleCreatePlan.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('删除 opens a danger confirm dialog naming the entry before any destructive call', async () => {
    await act(async () => {
      root.render(<ProjectDomainsRoute />);
    });
    const deleteButton = [...container.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('domainActionDelete'),
    );
    expect(deleteButton).toBeTruthy();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      deleteButton!.click();
    });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('deleteSiteDescription:{"name":"用户端入口"}');
  });

  it('确认删除 only fires the destructive hook action after the explicit confirm click', async () => {
    await act(async () => {
      root.render(<ProjectDomainsRoute />);
    });
    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((item) => item.textContent?.includes('domainActionDelete'))!
        .click();
    });
    // 确认前不得触发删除动作。
    expect(sitesHook.confirmDelete).not.toHaveBeenCalled();

    const confirmButton = [...document.querySelectorAll('[role="dialog"] button')].find((item) =>
      item.textContent?.includes('deleteSiteTitle'),
    );
    expect(confirmButton).toBeTruthy();
    await act(async () => {
      (confirmButton as HTMLButtonElement).click();
    });
    expect(sitesHook.confirmDelete).toHaveBeenCalledTimes(1);
  });

  it('DOM-3: 预览配置 opens the preview modal and requests the sync plan', async () => {
    await act(async () => {
      root.render(<ProjectDomainsRoute />);
    });
    const previewButton = [...container.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('domainActionPreview'),
    );
    expect(previewButton).toBeTruthy();
    await act(async () => {
      (previewButton as HTMLButtonElement).click();
    });
    expect(sitesHook.handleCreatePlan).toHaveBeenCalledWith('site-1');
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('domainConfigPreviewTitle');
    expect(dialog!.textContent).toContain('domainConfigPreviewEmpty');
  });
});
