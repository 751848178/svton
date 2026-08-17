import { catalogs, type TranslationKey } from './catalogs';
import type { InterpolationValues, Locale, Translator } from './types';

const TOKEN_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

export function translate(
  locale: Locale,
  key: TranslationKey,
  values?: InterpolationValues,
): string {
  const selected = catalogs[locale] as Readonly<Record<string, string>>;
  const fallback = catalogs.en as Readonly<Record<string, string>>;
  return translateFromCatalogs(selected, fallback, key, values);
}

export function translateFromCatalogs(
  selected: Readonly<Record<string, string>>,
  english: Readonly<Record<string, string>>,
  key: TranslationKey,
  values?: InterpolationValues,
): string {
  const template = selected[key] ?? english[key] ?? key;
  if (!values) return template;
  return template.replace(TOKEN_PATTERN, (token, name: string) => {
    const value = values[name];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : token;
  });
}

export function createTranslator(locale: Locale): Translator {
  return (key, values) => translate(locale, key, values);
}
