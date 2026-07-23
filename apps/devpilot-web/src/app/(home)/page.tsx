import { getTranslations } from 'next-intl/server';
import { Card } from '@svton/ui';
import { LinkButton } from '@/components/ui';
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
 *
 * 视觉节奏统一：hero / features / greeting 三段均用 py-20 + max-w-5xl，
 * 避免章节高度与内容宽度在滚动时跳动。
 */
export default async function HomePage() {
  const t = await getTranslations('home');

  return (
    <main className="min-h-screen">
      <section className="flex flex-col items-center justify-center px-4 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Devpilot
          </p>
          <h1 className="mx-auto mb-4 max-w-3xl text-4xl font-bold md:text-5xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mb-8 max-w-3xl text-lg text-muted-foreground">
            {t('heroSubtitle')}
          </p>
          <div className="flex justify-center gap-4">
            <LinkButton href="/dashboard" size="md" variant="primary">
              {t('ctaGetStarted')}
            </LinkButton>
            <HomeHeroCta />
          </div>
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-20">
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
