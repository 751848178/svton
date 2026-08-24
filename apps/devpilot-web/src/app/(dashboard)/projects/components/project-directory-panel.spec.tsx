// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDirectoryItem } from '../types';
import { ProjectDirectoryPanel } from './project-directory-panel';
import {
  directoryComponentLabel,
  directoryEnvColumns,
  parseVisibleEnvColumns,
  resolveVisibleEnvColumns,
} from './project-directory-columns.model';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../[id]/components/release-order-actions', () => ({
  ReleaseOrderActions: ({ actions }: { actions: Array<{ key: string; label: string }> }) => (
    <div data-testid="row-actions">{actions.map((a) => a.label).join(',')}</div>
  ),
}));

describe('ProjectDirectoryPanel columns & config popover', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  const headers = () =>
    [...container.querySelectorAll('thead th')].map((th) => th.textContent);

  async function renderPanel(items: ProjectDirectoryItem[]) {
    await act(async () => {
      root.render(
        <ProjectDirectoryPanel
          items={items}
          validating={false}
          empty={<span>empty-state</span>}
        />,
      );
    });
  }

  it('默认仅静态列（环境列全部隐藏），状态与组件为独立列', async () => {
    await renderPanel([project('p1', ['dev', 'production'])]);
    expect(headers()).toEqual([
      'directoryProject',
      'directoryStatus',
      'directoryComponents',
      'directoryLiveVersion',
      'directoryLatestRelease',
      'directoryActions',
    ]);
  });

  it('配置 popover：勾选环境列即时生效并持久化；全部显示/恢复默认语义不同', async () => {
    await renderPanel([project('p1', ['dev', 'production'])]);
    const trigger = container.querySelector('button[aria-haspopup="dialog"]') as HTMLElement;
    await act(async () => {
      trigger.click();
    });
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    const devCheck = [...dialog.querySelectorAll('input[type="checkbox"]')].find(
      (input) => input.closest('label')?.textContent === 'dev',
    ) as HTMLInputElement;
    await act(async () => {
      devCheck.click();
    });
    expect(headers()).toContain('dev');
    expect(
      JSON.parse(window.localStorage.getItem('projects.directory.visibleEnvColumns')!),
    ).toEqual(['dev']);
    const showAll = [...dialog.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('directoryColumnShowAll'),
    ) as HTMLElement;
    await act(async () => {
      showAll.click();
    });
    expect(headers()).toEqual(expect.arrayContaining(['dev', 'production']));
    const reset = [...dialog.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('directoryColumnResetDefault'),
    ) as HTMLElement;
    await act(async () => {
      reset.click();
    });
    expect(headers()).not.toContain('dev');
    expect(headers()).not.toContain('production');
    expect(
      JSON.parse(window.localStorage.getItem('projects.directory.visibleEnvColumns')!),
    ).toEqual([]);
  });

  it('点击配置区域外部自动收起；Esc 关闭并归还焦点', async () => {
    await renderPanel([project('p1', ['dev'])]);
    const trigger = container.querySelector('button[aria-haspopup="dialog"]') as HTMLElement;
    await act(async () => {
      trigger.click();
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => {
      trigger.click();
    });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('project-directory-columns.model', () => {
  it('unions environments in first-seen order', () => {
    const columns = directoryEnvColumns([
      project('p1', ['production', 'dev']),
      project('p2', ['dev', 'staging']),
    ]);
    expect(columns.map((c) => c.key)).toEqual(['production', 'dev', 'staging']);
  });

  it('excludes the production baseline environment from dynamic columns', () => {
    const item = project('p1', ['dev', 'production']);
    // fixture 的 production 环境标记为生产基线 → 不进动态列
    item.environments = item.environments.map((entry) =>
      entry.key === 'production' ? { ...entry, baselineRole: 'production' } : entry,
    );
    expect(directoryEnvColumns([item]).map((c) => c.key)).toEqual(['dev']);
  });

  it('parses visible columns defensively and ignores stale keys', () => {
    expect(parseVisibleEnvColumns(null)).toBeNull();
    expect(parseVisibleEnvColumns('not json')).toBeNull();
    expect(parseVisibleEnvColumns('{"a":1}')).toBeNull();
    expect(parseVisibleEnvColumns('["dev",1]')).toEqual(['dev']);
    const all = directoryEnvColumns([project('p1', ['dev', 'production'])]);
    expect(resolveVisibleEnvColumns(all, ['dev', 'gone'])).toHaveLength(1);
    expect(resolveVisibleEnvColumns(all, null)).toHaveLength(0);
  });

  it('formats component labels as [组件]:[端口]', () => {
    expect(
      directoryComponentLabel([
        { name: 'backend', port: 3000 },
        { name: 'admin', port: 3001 },
        { name: 'worker', port: null },
      ]),
    ).toBe('backend:3000 · admin:3001 · worker');
  });
});

function environment(key: string, version: string | null) {
  return {
    id: `env-${key}`,
    key,
    name: key,
    baselineRole: null,
    currentVersion: version,
    currentVersionEffectiveAt: version ? '2026-08-22T10:00:00Z' : null,
  };
}

function project(id: string, envKeys: string[]): ProjectDirectoryItem {
  return {
    id,
    name: `Project ${id}`,
    status: 'needs_configuration',
    repository: { provider: 'github', canonicalUrl: 'https://github.com/x/y' },
    intake: { projectType: 'backend_service', architecture: 'monorepo', componentCount: 2 },
    baselines: { staging: null, production: null },
    production: { currentVersion: '0.0.1', domain: 'picshare.example.com' },
    components: [
      { name: 'backend', port: 3000 },
      { name: 'admin', port: null },
    ],
    environments: envKeys.map((key) => environment(key, key === 'dev' ? null : '0.0.1')),
    latestReleaseAt: '2026-08-22T10:00:00Z',
    activity: {
      id: 'a1',
      type: 'release',
      status: 'ready',
      summary: null,
      occurredAt: '2026-08-22T10:00:00Z',
    },
    checkpoints: [],
    nextAction: null,
  } as ProjectDirectoryItem;
}
