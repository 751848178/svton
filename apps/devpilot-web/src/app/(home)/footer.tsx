import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * 首页页脚 — Server Component。
 *
 * 单一职责：营销页底部品牌标记 + 版权 + 极简链接。轻量、无交互。
 */
export async function Footer() {
  const t = await getTranslations('home');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Devpilot</p>
        <p>{t('footerCopyright', { year })}</p>
        <nav className="flex gap-4">
          <Link href="/login" className="hover:text-foreground hover:underline">
            {t('footerLogin')}
          </Link>
          <Link href="/dashboard" className="hover:text-foreground hover:underline">
            {t('footerDashboard')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
