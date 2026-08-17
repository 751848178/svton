import { beforeEach, describe, expect, it } from 'vitest';
import { encodeModelKey } from '@svton/agent-client';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { ProviderInfo } from '@svton/agent-ui';
import { BrowserSettingsAdapter } from '@/lib/browser-settings-adapter';
import { createWebModelRegistry } from '@/lib/web-model-registry';
import { loadSettings, saveSettings } from '@/lib/settings-store';
import { createTranslator, type Locale } from '@svton/ui';
import { createBrowserSettingsPresentationCopy } from '../src/lib/locale/web-presentation-copy';

const presentationCopy = (locale: Locale) =>
  createBrowserSettingsPresentationCopy(createTranslator(locale));

const providers = [
  {
    id: 'provider-a', name: 'Provider A', type: 'openai' as const,
    baseUrl: 'https://a.example', apiKey: 'a',
    models: [{
      id: 'shared', name: 'Shared A', reasoningEfforts: ['low', 'high'], hidden: false,
    }],
  },
  {
    id: 'provider-b', name: 'Provider B', type: 'anthropic' as const,
    baseUrl: 'https://b.example', apiKey: 'b',
    models: [{ id: 'shared', name: 'Shared B' }],
  },
];

describe('BrowserSettingsAdapter model registry synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSettings(providers);
  });

  it('keeps the removed active provider identity visible after a provider save', async () => {
    const registry = createWebModelRegistry();
    const adapter = new BrowserSettingsAdapter(
      {} as BrowserPlatform,
      presentationCopy('en'),
      undefined,
      registry,
    );
    await adapter.saveProviders([{
      id: 'provider-b', name: 'Provider B', type: 'anthropic',
      baseUrl: 'https://b.example', apiKey: 'b',
      models: [{ id: 'shared', name: 'Shared B' }],
    } as ProviderInfo]);

    const active = { providerId: 'provider-a', modelId: 'shared' };
    const options = registry.selectable(active);
    expect(options.find((record) => record.key.providerId === 'provider-a')).toMatchObject({
      value: encodeModelKey(active),
      providerName: 'Provider A',
      displayName: 'Shared A',
      removed: true,
    });
    expect(registry.display(active).providerName).not.toBe('Provider B');
  });

  it('preserves capability metadata for models retained by settings edits', async () => {
    const registry = createWebModelRegistry();
    const adapter = new BrowserSettingsAdapter(
      {} as BrowserPlatform, presentationCopy('en'), undefined, registry,
    );
    await adapter.saveProviders([{
      id: 'provider-a', name: 'Provider A renamed', type: 'openai',
      baseUrl: 'https://a.example', apiKey: 'a',
      models: [{ id: 'shared', name: 'Shared A renamed' }],
    } as ProviderInfo]);

    expect(loadSettings()[0].models[0].reasoningEfforts).toEqual(['low', 'high']);
    expect(registry.getSnapshot().records[0].reasoningEfforts).toEqual(['low', 'high']);
  });

  it.each([
    ['en', 'Web settings are stored in browser localStorage. Clearing browser data resets all settings.'],
    ['zh', 'Web 版设置存储在浏览器 localStorage 中。清除浏览器数据会重置所有配置。'],
  ] as const)('projects %s storage copy without mutating persistence', (locale, expected) => {
    const before = { ...localStorage };
    const adapter = new BrowserSettingsAdapter(
      {} as BrowserPlatform, presentationCopy(locale), undefined, createWebModelRegistry(),
    );
    expect(adapter.getStorageDescription()).toBe(expected);
    expect({ ...localStorage }).toEqual(before);
  });
});
