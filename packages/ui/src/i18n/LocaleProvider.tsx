'use client';

import React, { createContext, useMemo } from 'react';
import { formatDateTime, formatNumber, formatRelativeTime } from './formatters';
import { localeToLanguageTag } from './resolve-locale';
import { createTranslator } from './translate';
import type { I18nValue, Locale } from './types';

function createValue(locale: Locale): I18nValue {
  return {
    locale,
    languageTag: localeToLanguageTag(locale),
    translate: createTranslator(locale),
    formatDateTime: (value, options) => formatDateTime(locale, value, options),
    formatNumber: (value, options) => formatNumber(locale, value, options),
    formatRelativeTime: (value, now) => formatRelativeTime(locale, value, now),
  };
}

// Immutable English fallback keeps isolated components renderable. Product hosts
// still own locale explicitly by mounting LocaleProvider at every React root.
export const I18nContext = createContext<I18nValue>(createValue('en'));

export interface LocaleProviderProps {
  locale: Locale;
  children: React.ReactNode;
}

export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const value = useMemo(() => createValue(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
