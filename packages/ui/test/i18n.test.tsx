import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import {
  LocaleProvider,
  useI18n,
} from '../src/i18n';
import {
  formatDateTime,
  formatNumber,
  formatRelativeTime,
} from '../src/i18n/formatters';
import {
  enCatalog,
  enCatalogDomains,
  zhCatalog,
  zhCatalogDomains,
} from '../src/i18n/catalogs';
import {
  localeToLanguageTag,
  resolveAcceptLanguage,
  resolveBrowserLocale,
  resolveLanguageTag,
} from '../src/i18n/resolve-locale';
import { translate, translateFromCatalogs } from '../src/i18n/translate';
import type { TranslationKey } from '../src/i18n/types';
import { chatEnCatalog } from '../src/i18n/catalogs/chat.en';
import { sharedEnCatalog } from '../src/i18n/catalogs/shared.en';

function Greeting() {
  const { locale, translate: t } = useI18n();
  return <span data-testid="greeting" data-locale={locale}>{t('action.copy')}</span>;
}

const repositoryRoot = resolve(process.cwd(), '../..');

function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(repositoryRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

describe('request-safe i18n runtime', () => {
  it('preserves every legacy key and keeps catalog/domain parity unique', () => {
    const enKeys = Object.keys(enCatalog).sort();
    const zhKeys = Object.keys(zhCatalog).sort();
    expect(enKeys).toEqual(zhKeys);
    const legacyKeys = [...Object.keys(chatEnCatalog), ...Object.keys(sharedEnCatalog)];
    expect(enKeys).toEqual(expect.arrayContaining(legacyKeys));
    for (const domains of [enCatalogDomains, zhCatalogDomains]) {
      const keys = domains.flatMap((domain) => Object.keys(domain));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('keeps interpolation tokens identical across paired catalogs', () => {
    const tokens = (value: string) => [...value.matchAll(/\{([^{}]+)\}/g)]
      .map((match) => match[1])
      .sort();
    for (const key of Object.keys(enCatalog) as TranslationKey[]) {
      expect(tokens(zhCatalog[key]), key).toEqual(tokens(enCatalog[key]));
    }
  });

  it('falls back to English then the key and interpolates deterministically', () => {
    expect(translateFromCatalogs({}, { 'action.copy': 'Copy' }, 'action.copy')).toBe('Copy');
    expect(translateFromCatalogs({}, {}, 'missing.key' as TranslationKey)).toBe('missing.key');
    expect(translate('en', 'block.file_change.summary', { count: 3 })).toBe('3 files changed');
    expect(translate('en', 'block.file_change.summaryOne')).toBe('1 file changed');
    expect(translate('zh', 'chat.usingSkills', { skills: 'review' })).toBe('正在使用 review...');
    expect(translate('en', 'block.file_change.summary')).toBe('{count} files changed');
    expect(translate('en', 'block.file_change.summary', { other: 1 })).toBe('{count} files changed');
    expect(translate('en', 'web.artifact.export.downloaded', { filename: 'draft.md' }))
      .toBe('Downloaded the current draft: draft.md');
    expect(translate('zh', 'web.artifact.export.downloaded', { filename: 'draft.md' }))
      .toBe('已下载当前草稿：draft.md');
  });

  it.each([
    ['artifact.charactersOne', 'artifact.characters', '1 character', '2 characters', '0 characters', '1 个字符', '2 个字符', '0 个字符'],
    ['settings.marketplace.installCountOne', 'settings.marketplace.installCount', '1 install', '2 installs', '0 installs', '1 次安装', '2 次安装', '0 次安装'],
    ['settings.mcp.installCountOne', 'settings.mcp.installCount', '1 install', '2 installs', '0 installs', '1 次安装', '2 次安装', '0 次安装'],
    ['settings.checkpoint.messageCountOne', 'settings.checkpoint.messageCount', '1 message', '2 messages', '0 messages', '1 条消息', '2 条消息', '0 条消息'],
    ['block.file_change.summaryOne', 'block.file_change.summary', '1 file changed', '2 files changed', '0 files changed', '1 个文件变更', '2 个文件变更', '0 个文件变更'],
    ['review.findingCountOne', 'review.findingCount', '1 finding', '2 findings', '0 findings', '1 项发现', '2 项发现', '0 项发现'],
    ['review.errorCountOne', 'review.errorCount', '1 error', '2 errors', '0 errors', '1 个错误', '2 个错误', '0 个错误'],
    ['review.warningCountOne', 'review.warningCount', '1 warning', '2 warnings', '0 warnings', '1 个警告', '2 个警告', '0 个警告'],
    ['web.automation.toolCountOne', 'web.automation.toolCount', '1 tool is currently registered.', '2 tools are currently registered.', '0 tools are currently registered.', '当前已注册 1 个工具。', '当前已注册 2 个工具。', '当前已注册 0 个工具。'],
  ] as const)('selects singular and bounded plural copy for %s', (
    singularKey, pluralKey, enOne, enTwo, enZero, zhOne, zhTwo, zhZero,
  ) => {
    expect(translate('en', singularKey)).toBe(enOne);
    expect(translate('en', pluralKey, { count: 2 })).toBe(enTwo);
    expect(translate('en', pluralKey, { count: 0 })).toBe(enZero);
    expect(translate('zh', singularKey)).toBe(zhOne);
    expect(translate('zh', pluralKey, { count: 2 })).toBe(zhTwo);
    expect(translate('zh', pluralKey, { count: 0 })).toBe(zhZero);
  });

  it.each([
    ['zh', 'zh'], ['zh-Hans-CN', 'zh'], ['EN-us', 'en'], ['fr', null], ['*', null], ['', null],
  ] as const)('normalizes %s', (input, expected) => {
    expect(resolveLanguageTag(input)).toBe(expected);
  });

  it.each([
    ['zh-CN;q=0.8,en-US;q=0.9', 'en'],
    ['en;q=0.5,zh;q=0.5', 'en'],
    ['fr, zh;q=0.7, en;q=0.4', 'zh'],
    ['zh;q=0,en;q=0.2', 'en'],
    ['zh;q=nope,en;q=0.2', 'en'],
    ['*,fr', 'en'],
    ['', 'en'],
  ] as const)('resolves weighted header %s', (header, expected) => {
    expect(resolveAcceptLanguage(header)).toBe(expected);
  });

  it('resolves ordered browser languages and centralized document tags', () => {
    expect(resolveBrowserLocale(['fr-FR', 'zh-TW'], 'en-US')).toBe('zh');
    expect(resolveBrowserLocale(['fr-FR'], 'en-GB')).toBe('en');
    expect(resolveBrowserLocale([], undefined)).toBe('en');
    expect(localeToLanguageTag('zh')).toBe('zh-CN');
    expect(localeToLanguageTag('en')).toBe('en');
  });

  it('formats date, number and relative time only from an explicit locale', () => {
    const value = new Date('2026-08-04T01:02:03.000Z');
    expect(formatDateTime('en', value)).toBe(value.toLocaleString('en'));
    expect(formatDateTime('zh', value)).toBe(value.toLocaleString('zh-CN'));
    expect(formatDateTime('en', 'invalid')).toBe('—');
    expect(formatNumber('en', 1234.5)).toBe(new Intl.NumberFormat('en').format(1234.5));
    const now = Date.parse('2026-08-04T12:00:00Z');
    expect(formatRelativeTime('en', now - 59_000, now)).toBe('just now');
    expect(formatRelativeTime('zh', now - 60_000, now)).toBe('1分钟前');
    expect(formatRelativeTime('en', now - 34 * 86_400_000, now)).toBe('4 weeks ago');
    expect(formatRelativeTime('en', now - 35 * 86_400_000, now)).toBe('1 month ago');
    expect(formatRelativeTime('en', 'invalid', now)).toBe('—');
  });

  it('rerenders a provider from en to zh and deliberately defaults isolated components to en', () => {
    const fallback = render(<Greeting />);
    expect(screen.getByTestId('greeting')).toHaveTextContent('Copy');
    fallback.unmount();
    const view = render(<LocaleProvider locale="en"><Greeting /></LocaleProvider>);
    expect(screen.getByTestId('greeting')).toHaveTextContent('Copy');
    view.rerender(<LocaleProvider locale="zh"><Greeting /></LocaleProvider>);
    expect(screen.getByTestId('greeting')).toHaveTextContent('复制');
  });

  it('keeps 64 interleaved opposite-locale server renders isolated', () => {
    for (let index = 0; index < 64; index += 1) {
      const locale = index % 2 === 0 ? 'zh' : 'en';
      const html = renderToStaticMarkup(<LocaleProvider locale={locale}><Greeting /></LocaleProvider>);
      expect(html).toContain(locale === 'zh' ? '复制' : 'Copy');
      expect(html).not.toContain(locale === 'zh' ? '>Copy<' : '>复制<');
    }
  });

  it('keeps the server subpath source free of client and browser ownership', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/i18n/server.ts'), 'utf8');
    expect(source).not.toMatch(/use client|react|navigator|window|document/);
  });

  it('emits a self-contained server-safe subpath with no client or browser dependency', () => {
    for (const file of ['dist/i18n.mjs', 'dist/i18n.js']) {
      const path = resolve(process.cwd(), file);
      expect(existsSync(path), `${file} must be built before this guard`).toBe(true);
      const output = readFileSync(path, 'utf8');
      expect(output).not.toMatch(/use client|from ["']react|require\(["']react|\bnavigator\.(?:languages|language)\b|\bwindow\.(?:localStorage|location|document|addEventListener|removeEventListener|matchMedia)\b|\bdocument\.(?:documentElement|body|querySelector|createElement)\b/);
      expect(output).not.toMatch(/^import\s|require\(/m);
    }
    for (const file of ['dist/index.mjs', 'dist/index.js']) {
      const output = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(output.slice(0, 80), `${file} must retain the client boundary`).toMatch(/use client/);
    }
  });

  it('enforces removed-global, host-boundary, consumer and structure source guards', () => {
    const i18nFiles = sourceFiles('packages/ui/src/i18n');
    const consumerRoots = [
      'packages/ui/src/components',
      'packages/agent-ui/src/components',
      'apps/agent-web/src/components',
    ];
    const consumerFiles = consumerRoots.flatMap(sourceFiles);
    const maintained = [...i18nFiles, ...consumerFiles];
    const sources = maintained.map((file) => [file, readFileSync(resolve(repositoryRoot, file), 'utf8')] as const);
    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(/\bcurrentLocale\b|\bsetLocale\b|\bgetLocale\b|export function t\b/);
      expect(source, file).not.toMatch(/import\s*\{[^}]*\bt\b[^}]*\}\s*from\s*['"]@svton\/ui/);
    }
    const pureFiles = i18nFiles.filter((file) => !/LocaleProvider|use-i18n|\/index\.ts$/.test(file));
    for (const file of pureFiles) {
      const source = readFileSync(resolve(repositoryRoot, file), 'utf8');
      expect(source, file).not.toMatch(/['"]use client['"]|from ['"]react|\bnavigator\.(?:languages|language)\b|\bwindow\.(?:localStorage|location|document|addEventListener|removeEventListener|matchMedia)\b|\bdocument\.(?:documentElement|body|querySelector|createElement)\b/);
      expect(source, file).not.toMatch(/\.toLocaleString\(\)|new Intl\.(?:DateTimeFormat|NumberFormat|RelativeTimeFormat)\(\)/);
    }
    const webResolver = readFileSync(resolve(repositoryRoot, 'apps/agent-web/src/lib/locale/web-locale-host.ts'), 'utf8');
    expect(webResolver).toContain("from '@svton/ui/i18n'");
    expect(webResolver).not.toMatch(/from ['"]@svton\/ui['"]/);
    const layout = readFileSync(resolve(repositoryRoot, 'apps/agent-web/src/app/layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/suppressHydrationWarning|useEffect|navigator|localStorage|cookie/i);
    const localizedConsumers = consumerFiles.filter((file) => (
      readFileSync(resolve(repositoryRoot, file), 'utf8').includes('useI18n')
    ));
    const requiredLocalizedOwners = [
      'apps/agent-web/src/components/AgentLayout.tsx',
      'apps/agent-web/src/components/ChatContent.tsx',
      'apps/agent-web/src/components/Sidebar.tsx',
      'apps/agent-web/src/components/WebAutomationPanel.tsx',
      'apps/agent-web/src/components/WebSkillsPanel.tsx',
      'apps/agent-web/src/components/WebAgentsPanel.tsx',
      'apps/agent-web/src/components/WebIntegrationsPanel.tsx',
      'packages/agent-ui/src/components/chat/ToolApprovalModal.tsx',
      'packages/agent-ui/src/components/chat/UserInputForm.tsx',
      'packages/agent-ui/src/components/feedback/StartupStateView.tsx',
      'packages/agent-ui/src/components/layout/SessionActivityIndicator.tsx',
      'packages/agent-ui/src/components/layout/SessionManagementMenu.tsx',
      'packages/agent-ui/src/components/layout/Sidebar.tsx',
      'packages/agent-ui/src/components/settings/SettingsSectionContent.tsx',
      'packages/agent-ui/src/components/settings/sections/AutomationSection.tsx',
      'packages/agent-ui/src/components/settings/sections/MarketplaceSection.tsx',
      'packages/agent-ui/src/components/settings/sections/McpMarketplace.tsx',
      'packages/agent-ui/src/components/settings/sections/ProvidersSection.tsx',
    ];
    expect(localizedConsumers).toEqual(expect.arrayContaining(requiredLocalizedOwners));
    const rewritten = [
      ...i18nFiles,
      ...localizedConsumers,
      'apps/agent-web/src/app/layout.tsx',
      'apps/agent-desktop/src/main.tsx',
      'apps/agent-web/src/lib/locale/web-locale-host.ts',
      'apps/agent-web/src/lib/locale/web-locale-host.static.ts',
      'apps/agent-desktop/src/lib/locale/desktop-locale-host.ts',
    ];
    for (const file of new Set(rewritten)) {
      expect(readFileSync(resolve(repositoryRoot, file), 'utf8').split('\n').length, file).toBeLessThanOrEqual(200);
    }
  });
});
