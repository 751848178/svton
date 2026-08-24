// @vitest-environment jsdom

/** INFO-3 回归：/projects/:id 面包屑用项目名，未加载/失败时回退短 ID。 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

const mocks = vi.hoisted(() => ({
  pathname: '/projects/cmrwxl1ks000k6enjiclutd5a',
  projectName: null as string | null,
  query: '' as string,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.query ?? ''),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('swr', () => ({
  default: (key: unknown, fetcher: () => Promise<{ name?: string }>) => {
    // 由测试控制返回值：mocks.projectName 为 null 表示加载中/失败。
    void key;
    void fetcher;
    return { data: mocks.projectName ? { name: mocks.projectName } : undefined };
  },
}));

describe('Breadcrumbs project segment (INFO-3)', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    mocks.pathname = '/projects/cmrwxl1ks000k6enjiclutd5a';
    mocks.projectName = null;
  });
  afterEach(async () => act(async () => root.unmount()));

  it('shows the project name once loaded, without a raw cuid title (PX-3)', async () => {
    mocks.projectName = 'Picshare';
    await act(async () => root.render(<Breadcrumbs />));
    const text = container.textContent ?? '';
    expect(text).toContain('Picshare');
    expect(text).not.toContain('cmrwxl1k…');
    const projectLink = [...container.querySelectorAll('a,span')].find(
      (el) => el.textContent === 'Picshare',
    )!;
    expect(projectLink.getAttribute('title')).toBeNull();
  });

  it('falls back to the short id while the name is unavailable', async () => {
    await act(async () => root.render(<Breadcrumbs />));
    expect(container.textContent).toContain('cmrwxl1k…');
  });

  it('maps the settings sub-route segment to a translated label (SET-9)', async () => {
    mocks.pathname = '/projects/cmrwxl1ks000k6enjiclutd5a/settings';
    mocks.projectName = 'Picshare';
    await act(async () => root.render(<Breadcrumbs />));
    expect(container.textContent).toContain('projectSettings');
  });
});
