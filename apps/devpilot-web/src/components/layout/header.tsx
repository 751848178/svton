'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { TeamSwitcher } from './team-switcher';

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center gap-4">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">Devpilot</span>
          </Link>
          {isAuthenticated && <TeamSwitcher />}
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link
            href="/projects/new"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            创建项目
          </Link>
          <Link
            href="/resources"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            资源管理
          </Link>
          <Link
            href="/presets"
            className="transition-colors hover:text-foreground/80 text-foreground/60"
          >
            配置预设
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
              >
                退出
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
