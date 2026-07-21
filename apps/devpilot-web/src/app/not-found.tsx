import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * 根级 404 页面。
 *
 * 渲染在根 layout 内（html/body/NextIntlClientProvider 均可用），
 * 样式自包含：不占位任何路由组布局，全屏居中。
 * i18n 模式与 server 页面（如 (dashboard)/projects/page.tsx）一致：getTranslations。
 */
export default async function NotFound() {
  const t = await getTranslations('common');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <p className="text-6xl font-bold tracking-tight text-muted-foreground/40">404</p>
        <h1 className="text-2xl font-semibold">{t('notFoundTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('notFoundDescription')}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('backToHome')}
        </Link>
        <Link
          href="/projects"
          className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {t('goToProjects')}
        </Link>
      </div>
    </div>
  );
}
