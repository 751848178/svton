'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Popover } from '@svton/ui';
import { useAuthStore } from '@/store/hooks';

/**
 * Sidebar 底部用户卡。点击展开 Popover,提供「退出登录」。
 *
 * Phase 1 决策 D1:「个人资料」暂不渲染(devpilot-web 无 /profile 路由,避免死链),
 * Phase 2 配合新增 /profile 路由后补上。
 */
export function SidebarUserCard() {
  const t = useTranslations('common');
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const displayName = user?.name || user?.email || '';
  const email = user?.email || '';
  // initials:优先 name 前两字符,回退 email 前两字符,最终回退 '?'
  const initials = (user?.name || user?.email || '?').trim().slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <Popover
      placement="top"
      content={
        <div className="w-44 py-1">
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 w-full items-center rounded-md px-3 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            {t('logout')}
          </button>
        </div>
      }
    >
      <button
        type="button"
        className="flex h-16 w-full items-center gap-3 rounded-lg border border-sidebar-border bg-card px-3 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-[13px] font-bold text-foreground">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
      </button>
    </Popover>
  );
}
