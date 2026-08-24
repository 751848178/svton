// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Drawer, Modal } from '@svton/ui';
import { ProjectDirectoryPanel } from '../../components/project-directory-panel';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('F453 Drawer/Dialog width + scroll bounds (AC-UI-023)', () => {
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
  });

  it('Modal caps width to the viewport and keeps content scrollable inside', async () => {
    await act(async () => {
      root.render(
        <Modal
          open
          onClose={vi.fn()}
          title="Dialog"
          width={760}
        >
          <p>content</p>
        </Modal>,
      );
    });
    // 当前结构：max-w 约束在 [role=dialog] 面板元素自身（内容区为其子 div）。
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(panel).not.toBeNull();
    expect(panel!.className).toContain('max-w-[calc(100vw-32px)]');
    expect(panel!.className).toContain('max-h-[calc(100vh-64px)]');
    const body = panel!.querySelector<HTMLDivElement>('div.flex-1');
    expect(body).not.toBeNull();
    expect(body!.className).toContain('overflow-auto');
  });

  it('Drawer caps width and keeps content scrollable inside', async () => {
    await act(async () => {
      root.render(
        <Drawer
          open
          onClose={vi.fn()}
          title="Logs"
          width="min(760px, 100vw)"
        >
          <p>content</p>
        </Drawer>,
      );
    });
    const panel = document.querySelector<HTMLDivElement>('[role="dialog"]');
    expect(panel).not.toBeNull();
    expect(panel!.style.width).toBe('min(760px, 100vw)');
    const body = panel!.querySelector<HTMLDivElement>('div.flex-1');
    expect(body).not.toBeNull();
    expect(body!.className).toContain('overflow-auto');
  });
});

describe('F453 responsive structural patterns (AC-UI-019..021)', () => {
  it('directory panel keeps its table inside a horizontal scroll container', () => {
    const html = renderToStaticMarkup(
      <ProjectDirectoryPanel
        items={[]}
        validating={false}
      />,
    );
    // 重设计后：真表格 + overflow-x-auto（窄屏横向滚动而非压扁），列头含线上版本/最新发布时间。
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('directoryLiveVersion');
    expect(html).toContain('directoryLatestRelease');
  });

  it('workbench steps bar stacks below 820px', () => {
    const source = readSource(
      'src/app/(dashboard)/projects/[id]/components/release-workbench/release-workbench-steps.tsx',
    );
    expect(source).toContain('max-[820px]:flex-col');
    expect(source).toContain('max-[820px]:w-full');
    expect(source).toContain('max-[820px]:self-center');
    expect(source).toContain('max-[820px]:rotate-90');
  });

  it('evidence tables scroll inside wrappers, not the page', () => {
    // PX-5：发布详情两张历史表改用 ReleaseScrollTable（overflow-x-auto + 右缘渐隐提示），
    // 且去掉固定 min-width（操作列不再被裁出抽屉视口）。
    const wrappedBySharedScroll = [
      'src/app/(dashboard)/projects/[id]/components/release-build-history-table.tsx',
      'src/app/(dashboard)/projects/[id]/components/release-staging-evidence-list.tsx',
    ];
    for (const file of wrappedBySharedScroll) {
      const source = readSource(file);
      expect(source).toContain('<ReleaseScrollTable>');
      expect(source).not.toMatch(/min-w-\[\d+px\]/);
    }
    const scrollWrapper = readSource(
      'src/app/(dashboard)/projects/[id]/components/release-workbench/release-scroll-table.tsx',
    );
    expect(scrollWrapper).toMatch(/overflow-x-auto/);
    expect(scrollWrapper).toMatch(/bg-gradient-to-l/);
    const finalize = readSource(
      'src/app/(dashboard)/projects/create/components/finalize-baseline-step.tsx',
    );
    expect(finalize).toMatch(/<div className="overflow-x-auto[^"]*">/);
    expect(finalize).toMatch(/min-w-\[\d+px\]/);
  });
});

function readSource(file: string) {
  const fs = require('node:fs');
  return fs.readFileSync(file, 'utf8');
}
