// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './header';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a
      href={String(href)}
      {...props}
    >
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/projects/create',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'zh',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@svton/hooks', () => ({ usePersistFn: (fn: unknown) => fn }));
vi.mock('@/store/hooks', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    logout: vi.fn(),
    user: { email: 'admin@example.test', name: 'Admin', role: 'admin' },
  }),
}));
vi.mock('./team-switcher', () => ({ TeamSwitcher: () => <button>team</button> }));
vi.mock('./nav-icons', () => ({ NavIcon: () => <span /> }));

describe('Header responsive layout', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('reserves the wrapped menu row and opens navigation below the full header', async () => {
    await act(async () => root.render(<Header />));
    const header = container.querySelector('header');
    const menuButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('mobileMenu'),
    );

    expect(header?.className.split(' ')).not.toContain('h-14');
    expect(header?.className).toContain('md:h-14');
    expect(header?.firstElementChild?.className).toContain('min-h-14');
    expect(menuButton?.parentElement?.className).toContain('pb-2');

    await act(async () => menuButton?.click());
    const expandedNavigation = container.querySelector('nav.absolute');
    expect(expandedNavigation?.className).toContain('top-full');
    expect(expandedNavigation?.className).not.toContain('top-14');
  });
});
