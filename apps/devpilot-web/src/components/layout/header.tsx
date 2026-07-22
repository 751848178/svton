'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/hooks';
import { filterNavSectionsByRole, findActiveNavItem, navigationSections, primaryHeaderLinks } from './navigation-items';
import { TeamSwitcher } from './team-switcher';

export function Header() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = usePersistFn(() => {
    logout();
    setMobileMenuOpen(false);
    router.push('/login');
  });

  const closeMobileMenu = usePersistFn(() => {
    setMobileMenuOpen(false);
  });

  // 主链接高亮:前缀命中取最长匹配
  const activeHeaderLink = findActiveNavItem(pathname, primaryHeaderLinks);

  // 移动端折叠面板与 sidebar 消费同一数据源,渲染层按角色过滤 /admin/* 项
  const visibleSections = filterNavSectionsByRole(navigationSections, user?.role);

  return (
    <header className="relative z-50 h-14 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full w-full flex-wrap items-center gap-2 px-4 md:px-6 md:flex-nowrap">
        <div className="mr-2 flex min-w-0 items-center gap-3 md:mr-4 md:gap-4">
          <Link
            href={isAuthenticated ? '/dashboard' : '/'}
            className="flex min-h-11 shrink-0 items-center space-x-2"
          >
            <span className="font-bold text-xl">Devpilot</span>
          </Link>
          {isAuthenticated && <TeamSwitcher />}
        </div>
        <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
          {primaryHeaderLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'inline-flex min-h-11 items-center rounded-md px-3 transition-colors',
                activeHeaderLink?.href === link.href
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground/60 hover:text-foreground/80',
              )}
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
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground md:px-4"
              >
                {tc('logout')}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {tc('login')}
            </Link>
          )}
        </div>
        {isAuthenticated ? (
          // 移动端折叠按钮:常驻 header 内;展开后的面板 absolute 浮在 main 之上(避免被 h-14 header 裁掉)
          <div className="w-full shrink-0 md:hidden">
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="flex min-h-11 w-full shrink-0 items-center justify-between whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span>{t('mobileMenu')}</span>
              <span aria-hidden="true">{mobileMenuOpen ? t('mobileMenuCollapse') : t('mobileMenuExpand')}</span>
            </button>
            {mobileMenuOpen ? (
              <nav className="absolute inset-x-0 top-14 z-50 max-h-[60vh] overflow-y-auto border bg-background p-3 shadow-sm">
                {visibleSections.map((section) => {
                  // 移动端面板与 sidebar 共用同一高亮规则(最长匹配)
                  const activeItem = findActiveNavItem(pathname, section.items);
                  return (
                  <div
                    key={section.titleKey}
                    className="pb-3 last:pb-0"
                  >
                    <h2 className="px-1 pb-2 text-xs font-semibold text-muted-foreground">
                      {t(section.titleKey)}
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {section.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMobileMenu}
                          className={cn(
                            'flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            activeItem?.href === item.href
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                        >
                          {t(item.labelKey)}
                        </Link>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </nav>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
