import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { initializeDesktopLocale } from '../src/lib/locale/desktop-locale-host';

describe('Desktop locale bootstrap', () => {
  it.each([
    [['en-US'], 'en-US', 'en', 'en'],
    [['zh-CN'], 'en-US', 'zh', 'zh-CN'],
    [['fr-FR'], 'zh-TW', 'zh', 'zh-CN'],
    [['fr-FR'], 'fr-FR', 'en', 'en'],
    [[], undefined, 'en', 'en'],
  ] as const)('resolves %j before the root and sets the matching document language', (
    languages, language, expectedLocale, expectedTag,
  ) => {
    const documentElement = { lang: '' };
    expect(initializeDesktopLocale(documentElement, languages, language)).toBe(expectedLocale);
    expect(documentElement.lang).toBe(expectedTag);
  });

  it('owns both normal and block-showcase roots with the same provider locale', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');
    expect(source.indexOf('initializeDesktopLocale(')).toBeLessThan(source.indexOf('new URLSearchParams'));
    expect(source).toContain('<LocaleProvider locale={locale}>{content}</LocaleProvider>');
    expect(source).toContain('renderRoot(<BlockShowcase />)');
    expect(source).toContain('renderRoot(<App />)');
    expect(source.match(/createRoot\(/g)).toHaveLength(1);
  });
});
