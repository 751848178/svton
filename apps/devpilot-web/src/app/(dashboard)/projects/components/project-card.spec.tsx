import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectDirectoryItem } from '../types';
import { ProjectDirectoryRow } from './project-card';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../[id]/components/release-order-actions', () => ({
  ReleaseOrderActions: ({ actions }: { actions: Array<{ key: string; label: string }> }) => (
    <div data-testid="row-actions">{actions.map((a) => a.label).join('|')}</div>
  ),
}));

describe('ProjectDirectoryRow', () => {
  it('项目名是正常字重的链接；无 icon、无仓库地址；副行仅形态元信息', () => {
    const html = renderToStaticMarkup(
      <ProjectDirectoryRow
        project={project()}
        envColumns={[{ id: 'env-dev', key: 'dev', name: 'dev' }]}
      />,
    );
    expect(html).toMatch(/class="text-sm text-primary hover:underline"/);
    expect(html).not.toContain('font-semibold');
    expect(html).toContain('href="/projects/project-1"');
    expect(html).toContain('projectTypeBackendService · architectureMonorepo');
    expect(html).not.toContain('componentCount');
    expect(html).not.toContain('github.com');
  });

  it('状态为纯文案+色值（不套标签）；组件列整体收窄 + 气泡一行一个组件且可移入', () => {
    const html = renderToStaticMarkup(
      <ProjectDirectoryRow
        project={project()}
        envColumns={[]}
      />,
    );
    expect(html).toContain('statusNeedsConfiguration');
    // 纯文案带色值，非 Tag 标签结构
    expect(html).toContain('text-amber-700');
    expect(html).not.toContain('statusOnline');
    // 组件列整体收窄（td 上限，非仅内容）
    expect(html).toContain('max-w-[8.5rem]');
    // 气泡：内部 padding 桥（pt-1）+ 无 pointer-events-none → 鼠标可移入
    expect(html).toContain('group-hover:block');
    expect(html).toContain('pt-1');
    expect(html).not.toContain('pointer-events-none');
    for (const row of ['backend:3000', 'admin:3001']) {
      const occurrences = html.split(row).length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(2); // 截断行 + 气泡行
    }
  });

  it('线上版本/域名/最新发布时间与环境列正常渲染', () => {
    const html = renderToStaticMarkup(
      <ProjectDirectoryRow
        project={project()}
        envColumns={[{ id: 'env-1', key: 'production', name: 'production' }]}
      />,
    );
    expect(html).toContain('0.0.1');
    expect(html).toContain('picshare.example.com');
    expect(html).toContain('2026-08-22 18:00');
    expect(html).toContain('env=production');
    expect(html).toContain('directoryEnvBaselineReady');
  });

  it('收集项目全部动作进操作列', () => {
    const html = renderToStaticMarkup(
      <ProjectDirectoryRow
        project={project()}
        envColumns={[]}
      />,
    );
    const actions = html.match(/data-testid="row-actions">([^<]*)</)?.[1] ?? '';
    // IA 重构：部署记录跟随发布，项目行不再提供独立部署动作。
    expect(actions.split('|')).toEqual([
      'projectDeliveryFixNow',
      'enterProject',
      'workbenchTabReleases',
      'workbenchTabConfiguration',
      'workbenchTabDomains',
    ]);
  });
});

function project(): ProjectDirectoryItem {
  return {
    id: 'project-1', name: 'Payments', status: 'needs_configuration',
    repository: { provider: 'github', canonicalUrl: 'https://github.com/example/payments' },
    intake: { projectType: 'backend_service', architecture: 'monorepo', componentCount: 2 },
    baselines: {
      staging: null,
      production: { id: 'env-1', key: 'production', name: 'Production', ready: true },
    },
    production: { currentVersion: '0.0.1', domain: 'picshare.example.com' },
    components: [
      { name: 'backend', port: 3000 },
      { name: 'admin', port: 3001 },
    ],
    environments: [
      {
        id: 'env-1', key: 'production', name: 'production', baselineRole: 'production',
        currentVersion: '0.0.1', currentVersionEffectiveAt: '2026-08-22T10:00:00Z',
      },
    ],
    latestReleaseAt: '2026-08-22T10:00:00Z',
    activity: {
      id: 'activity-1', type: 'release', status: 'ready', summary: null,
      occurredAt: '2026-08-22T10:00:00Z',
    },
    checkpoints: [],
    nextAction: {
      kind: 'bind_target',
      href: '/projects/project-1/settings?section=environments',
    },
  };
}
