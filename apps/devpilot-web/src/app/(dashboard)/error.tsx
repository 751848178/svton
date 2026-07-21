'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorBanner } from '@/components/ui';

/**
 * (dashboard) 路由段错误边界。
 *
 * 渲染时替代 children、位于 dashboard layout 内，样式自包含居中。
 * client 组件，i18n 用 useTranslations（NextIntlClientProvider 在根 layout）。
 * 重试调用 reset() 重新渲染该路由段。
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error('Dashboard route segment error:', error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-lg space-y-3">
        <h2 className="text-lg font-semibold">{t('routeError')}</h2>
        <p className="text-sm text-muted-foreground">{t('routeErrorDescription')}</p>
        <ErrorBanner
          variant="page"
          message={error.digest ? `${t('routeErrorHint')}（${error.digest}）` : t('routeErrorHint')}
          onRetry={reset}
          retryLabel={t('retry')}
        />
      </div>
    </div>
  );
}
