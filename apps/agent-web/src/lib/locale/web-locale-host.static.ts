import type { Locale } from '@svton/ui/i18n';

/** Fixed build locale. next.config validates this before a static build starts. */
export async function resolveWebLocale(): Promise<Locale> {
  const locale = process.env.SVTON_STATIC_EXPORT_LOCALE;
  if (locale !== 'zh' && locale !== 'en') {
    throw new Error('Static locale was not validated before layout rendering');
  }
  return locale;
}
