import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * 认证页（登录 / 注册）布局。
 *
 * 单一职责：居中容器 + 品牌头部（logo + 回首页链接）。
 * 此前两个页面各自复制 `flex min-h-screen items-center justify-center bg-background`，
 * 现收归至此；并把纯裸 Card 包上品牌，避免认证页无品牌感。
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <Link href="/" className="text-xl font-bold">
          Devpilot
        </Link>
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          {t('backToHome')}
        </Link>
      </div>
      {children}
    </div>
  );
}
