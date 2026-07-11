'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Avatar } from '@svton/ui';
import { useAuthStore } from '@/store/hooks';
import { TeamSwitcher } from './team-switcher';

const primaryLinks = [
  { href: '/projects', labelKey: 'myProjects' },
  { href: '/projects/new', labelKey: 'createProject' },
  { href: '/resources', labelKey: 'resourceManagement' },
  { href: '/presets', labelKey: 'presets' },
  { href: '/teams', labelKey: 'teamManagement' },
];

export function Header() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = usePersistFn(() => {
    logout();
    router.push('/login');
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex min-h-14 flex-wrap items-center gap-2 py-2 md:flex-nowrap md:py-0">
        <div className="mr-2 flex min-w-0 items-center gap-3 md:mr-4 md:gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center space-x-2"
          >
            <span className="font-bold text-xl">Devpilot</span>
          </Link>
          {isAuthenticated && <TeamSwitcher />}
        </div>
        <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
          {primaryLinks.slice(1, 4).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 items-center justify-end space-x-2">
          {isAuthenticated && user ? (
            <div className="flex min-w-0 items-center gap-2 md:gap-4">
              <span className="max-w-[120px] truncate text-sm text-muted-foreground md:max-w-[220px]">
                {user.name || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground md:px-4"
              >
                {tc('logout')}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              {tc('login')}
            </Link>
          )}
        </div>
        {isAuthenticated ? (
          <nav className="-mx-1 flex w-full gap-2 overflow-x-auto pb-1 text-sm font-medium md:hidden">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
