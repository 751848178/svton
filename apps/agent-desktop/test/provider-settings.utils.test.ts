import { describe, expect, it } from 'vitest';
import {
  toConfigProviders,
  toProviderInfoList,
} from '../src/lib/provider-settings.utils';
import type { SvtonConfig } from '../src/lib/config-store';

describe('provider settings mapping', () => {
  it('keeps the independent API protocol when providers are saved from UI state', () => {
    const current: SvtonConfig['providers'] = {
      deepseek: {
        type: 'openai',
        api: 'openai-completions',
        base_url: 'https://api.deepseek.com',
        api_key: 'test-key',
        models: { 'deepseek-chat': 'DeepSeek Chat' },
      },
    };

    const displayed = toProviderInfoList(current);
    displayed[0].models.push({ id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' });
    const mapped = toConfigProviders(current, displayed);

    expect(mapped.deepseek.api).toBe('openai-completions');
    expect(mapped.deepseek.models).toEqual({
      'deepseek-chat': 'DeepSeek Chat',
      'deepseek-reasoner': 'DeepSeek Reasoner',
    });
  });
});
