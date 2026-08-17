import type { Locale, LocaleLanguageTag } from './types';

const LANGUAGE_TAGS: Record<Locale, LocaleLanguageTag> = {
  zh: 'zh-CN',
  en: 'en',
};

export function localeToLanguageTag(locale: Locale): LocaleLanguageTag {
  return LANGUAGE_TAGS[locale];
}

export function resolveLanguageTag(language: string | null | undefined): Locale | null {
  const normalized = language?.trim().toLowerCase();
  if (!normalized || normalized === '*') return null;
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return null;
}

interface WeightedLanguage {
  locale: Locale;
  weight: number;
  index: number;
}

export function resolveAcceptLanguage(header: string | null | undefined): Locale {
  const candidates: WeightedLanguage[] = [];
  for (const [index, entry] of (header ?? '').split(',').entries()) {
    const [range = '', ...parameters] = entry.trim().split(';');
    let weight = 1;
    let valid = true;
    for (const parameter of parameters) {
      const match = parameter.trim().match(/^q=(.+)$/i);
      if (!match) continue;
      const parsed = Number(match[1]);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) valid = false;
      else weight = parsed;
    }
    const locale = valid && weight > 0 ? resolveLanguageTag(range) : null;
    if (locale) candidates.push({ locale, weight, index });
  }
  candidates.sort((left, right) => right.weight - left.weight || left.index - right.index);
  return candidates[0]?.locale ?? 'en';
}

export function resolveBrowserLocale(
  languages: readonly string[] | null | undefined,
  language?: string | null,
): Locale {
  for (const value of [...(languages ?? []), ...(language ? [language] : [])]) {
    const locale = resolveLanguageTag(value);
    if (locale) return locale;
  }
  return 'en';
}
