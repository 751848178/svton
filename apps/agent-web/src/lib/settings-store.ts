/**
 * Shared localStorage keys and settings persistence for agent-web.
 * Single source of truth — consumed by agent-setup.ts and settings pages.
 */

export interface ProviderSetting {
  id: string;
  name: string;
  type: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  models: { id: string; name: string }[];
}

// ── localStorage keys ──────────────────────────────────────

export const LS_SETTINGS = 'agent-web:settings';
export const LS_DISABLED_TOOLS = 'agent-web:disabledTools';
export const LS_PERMISSION_MODE = 'agent-web:permissionMode';
export const LS_CUSTOM_INSTRUCTIONS = 'agent-web:customInstructions';
export const LS_DISABLED_SKILLS = 'agent-web:disabledSkills';
export const LS_SEARCH_ENDPOINT = 'agent-web:searchEndpoint';
export const LS_DEFAULT_MODEL = 'agent-web:defaultModel';

// ── Provider settings persistence ──────────────────────────

export const DEFAULT_PROVIDERS: ProviderSetting[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com',
    apiKey: '',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-haiku-4-20250506', name: 'Claude Haiku 4' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    ],
  },
];

export function loadSettings(): ProviderSetting[] {
  if (typeof window === 'undefined') return DEFAULT_PROVIDERS;

  try {
    const stored = localStorage.getItem(LS_SETTINGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.providers || DEFAULT_PROVIDERS;
    }
  } catch {
    // ignore
  }
  return DEFAULT_PROVIDERS;
}

export function saveSettings(settings: ProviderSetting[]): void {
  localStorage.setItem(LS_SETTINGS, JSON.stringify({ providers: settings }));
}

// ── Generic helpers for simple JSON values ─────────────────

export function loadJsonList(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function loadString(key: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(key) || '';
}

export function saveString(key: string, value: string): void {
  localStorage.setItem(key, value);
}

export function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}
