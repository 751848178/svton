// @vitest-environment jsdom

/** INFO-3 回归：/projects/:id 面包屑用项目名，未加载/失败时回退短 ID。 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

const mocks = vi.hoisted(() => ({
  pathname: '/projects/cmrwxl1ks000k6enjiclutd5a',
  projectName: null as string | null,
  releaseName: null as string | null,
  query: '' as string,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.query ?? ''),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('swr', () => ({
  default: (key: unknown, fetcher: () => Promise<unknown>) => {
    // 由测试控制返回值：mocks.projectName 为 null 表示加载中/失败。
    void fetcher;
    if (String(key).startsWith('breadcrumb:release-order:')) {
      return { data: mocks.releaseName ? { releaseName: mocks.releaseName } : undefined };
    }
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
    mocks.releaseName = null;
    mocks.query = '';
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

  it('uses the real release display name for a path-based release detail breadcrumb', async () => {
    mocks.pathname = '/projects/cmrwxl1ks000k6enjiclutd5a/releases/cmsmzs63q00ek1700clhiytmj';
    mocks.projectName = 'Picshare';
    mocks.releaseName = 'Release 1.2.3';
    mocks.query = '';
    await act(async () => root.render(<Breadcrumbs />));
    expect(container.textContent).toContain('Release 1.2.3');
    expect(container.textContent).not.toContain('cmsmzs63…');
  });

  it('keeps navigable breadcrumb links at a 44px touch target height', async () => {
    mocks.pathname = '/projects/cmrwxl1ks000k6enjiclutd5a/releases';
    mocks.projectName = 'Picshare';
    await act(async () => root.render(<Breadcrumbs />));
    const links = [...container.querySelectorAll('a')];
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.className.includes('min-h-11'))).toBe(true);
  });
});
