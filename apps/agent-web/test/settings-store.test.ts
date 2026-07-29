/**
 * settings-store tests (PI008) — the credential-storage boundary for agent-web.
 *
 * Verifies the migration-relevant seam: ProviderSetting shape, DEFAULT_PROVIDERS
 * (the catalog that feeds createPiModelsForProvider), and the localStorage
 * round-trip that initAgentConfig reads via loadSettings().
 *
 * jsdom provides localStorage; tests reset it between cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  loadString,
  saveString,
  loadJsonList,
  saveJson,
  DEFAULT_PROVIDERS,
  LS_SETTINGS,
  type ProviderSetting,
} from '@/lib/settings-store';

describe('settings-store — DEFAULT_PROVIDERS catalog', () => {
  it('exposes openai + anthropic + deepseek providers', () => {
    const ids = DEFAULT_PROVIDERS.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('anthropic');
    expect(ids).toContain('deepseek');
  });

  it('every provider declares a type in {openai, anthropic} (PiProviderFamily)', () => {
    for (const p of DEFAULT_PROVIDERS) {
      expect(['openai', 'anthropic']).toContain(p.type);
      expect(p.models.length).toBeGreaterThan(0);
    }
  });

  it('anthropic provider carries claude models used by createPiModelsForProvider', () => {
    const anthropic = DEFAULT_PROVIDERS.find((p) => p.type === 'anthropic')!;
    const modelIds = anthropic.models.map((m) => m.id);
    expect(modelIds.some((id) => id.startsWith('claude'))).toBe(true);
  });
});

describe('settings-store — localStorage round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadSettings returns DEFAULT_PROVIDERS when storage is empty', () => {
    const settings = loadSettings();
    expect(settings).toBe(DEFAULT_PROVIDERS);
  });

  it('saveSettings + loadSettings round-trips provider list with apiKey', () => {
    const custom: ProviderSetting[] = [
      {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test-KEY',
        models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
      },
    ];
    saveSettings(custom);
    expect(JSON.parse(localStorage.getItem(LS_SETTINGS)!).providers).toEqual(custom);

    const loaded = loadSettings();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].apiKey).toBe('sk-test-KEY');
    expect(loaded[0].models[0].id).toBe('gpt-4o');
  });

  it('loadSettings falls back to DEFAULT_PROVIDERS on corrupt JSON', () => {
    localStorage.setItem(LS_SETTINGS, '{not valid json');
    expect(loadSettings()).toBe(DEFAULT_PROVIDERS);
  });

  it('loadSettings falls back when providers field is missing', () => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify({ other: 1 }));
    expect(loadSettings()).toBe(DEFAULT_PROVIDERS);
  });
});

describe('settings-store — generic helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadString / saveString round-trip', () => {
    expect(loadString('agent-web:searchEndpoint')).toBe('');
    saveString('agent-web:searchEndpoint', 'https://searxng.example.com/search');
    expect(loadString('agent-web:searchEndpoint')).toBe('https://searxng.example.com/search');
  });

  it('loadJsonList returns [] on empty / corrupt', () => {
    expect(loadJsonList('agent-web:disabledTools')).toEqual([]);
    localStorage.setItem('agent-web:disabledTools', '{bad');
    expect(loadJsonList('agent-web:disabledTools')).toEqual([]);
  });

  it('saveJson + loadJsonList round-trip a disabled-tools list', () => {
    saveJson('agent-web:disabledTools', ['bash', 'web_fetch']);
    expect(loadJsonList('agent-web:disabledTools')).toEqual(['bash', 'web_fetch']);
  });
});
