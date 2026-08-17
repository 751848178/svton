import {
  localeToLanguageTag,
  resolveBrowserLocale,
  type Locale,
} from '@svton/ui/i18n';

export function initializeDesktopLocale(
  documentElement: Pick<HTMLElement, 'lang'>,
  languages: readonly string[] | null | undefined,
  language?: string | null,
): Locale {
  const locale = resolveBrowserLocale(languages, language);
  documentElement.lang = localeToLanguageTag(locale);
  return locale;
}
