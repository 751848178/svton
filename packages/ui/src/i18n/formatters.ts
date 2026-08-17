import { localeToLanguageTag } from './resolve-locale';
import { translate } from './translate';
import type { Locale } from './types';

export const INVALID_DATE_FALLBACK = '—';

function toTimestamp(value: Date | number | string): number {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

export function formatDateTime(
  locale: Locale,
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) return INVALID_DATE_FALLBACK;
  return new Date(timestamp).toLocaleString(localeToLanguageTag(locale), options);
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(localeToLanguageTag(locale), options).format(value);
}

export function formatRelativeTime(
  locale: Locale,
  value: Date | number | string,
  now = Date.now(),
): string {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) return INVALID_DATE_FALLBACK;
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return translate(locale, 'status.justNow');
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const [unit, amount] = minutes < 60
    ? ['minute', -minutes] as const
    : hours < 24
      ? ['hour', -hours] as const
      : days < 7
        ? ['day', -days] as const
        : weeks < 5
          ? ['week', -weeks] as const
          : ['month', -Math.floor(days / 30)] as const;
  return new Intl.RelativeTimeFormat(localeToLanguageTag(locale), { numeric: 'always' }).format(amount, unit);
}
