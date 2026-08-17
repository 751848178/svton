export type Locale = 'zh' | 'en';
export type LocaleLanguageTag = 'zh-CN' | 'en';
export type InterpolationValue = string | number;
export type InterpolationValues = Readonly<Record<string, InterpolationValue>>;

export type Translator = (
  key: TranslationKey,
  values?: InterpolationValues,
) => string;

export interface I18nValue {
  locale: Locale;
  languageTag: LocaleLanguageTag;
  translate: Translator;
  formatDateTime: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatRelativeTime: (timestamp: Date | number | string, now?: number) => string;
}

export type TranslationKey = import('./catalogs').TranslationKey;
