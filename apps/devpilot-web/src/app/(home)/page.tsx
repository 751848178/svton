import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card } from '@svton/ui';
import { HomeGreeting } from './HomeGreeting';
import { HomeHeroCta } from './HomeHeroCta';

/** 功能卡 i18n key 列表，与 messages 中 home namespace 一一对应。 */
const FEATURE_KEYS = [
  'projectWizard',
  'resourceApproval',
  'siteCdn',
  'monitoring',
  'logs',
  'governance',
] as const;

/**
 * 首页 — Server Component。
 *
 * 静态营销内容在 server 渲染（getTranslations）；登录态相关的
 * Hero 次要 CTA 与「欢迎回来」区块由 client 组件承担。
 */
export default async function HomePage() {
  const t = await getTranslations('home');

  return (
    <main className="min-h-screen">
      <section className="flex flex-col items-center justify-center px-4 py-24">
        <div className="max-w-3xl text-center">
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">Devpilot</h1>
          <p className="mb-8 text-lg text-muted-foreground">{t('heroSubtitle')}</p>
          <div className="flex justify-center gap-4">
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              {t('ctaCreate')}
            </Link>
            <HomeHeroCta />
          </div>
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-2xl font-bold">{t('featuresTitle')}</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {FEATURE_KEYS.map((key) => (
              <Card
                key={key}
                title={t(`features.${key}.title`)}
              >
                <p className="text-sm text-muted-foreground">{t(`features.${key}.description`)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <HomeGreeting />
    </main>
  );
}
