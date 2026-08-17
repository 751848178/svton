import { describe, expect, it } from 'vitest';
import { encodeModelKey } from '@svton/agent-client';
import type { SvtonConfig } from '../src/lib/config-store';
import { resolveDesktopModelSelection } from '../src/lib/desktop-model-selection';

const config: SvtonConfig = {
  model: { provider: 'provider-a', name: 'shared' },
  providers: {
    'provider-a': {
      type: 'openai', base_url: 'https://a.example', api_key: 'a',
      models: { shared: 'Shared A' },
    },
    'provider-b': {
      type: 'openai', base_url: 'https://b.example', api_key: 'b',
      models: { shared: 'Shared B' },
    },
  },
};

describe('desktop model selection', () => {
  it('resolves a provider-qualified duplicate to the exact provider', () => {
    expect(resolveDesktopModelSelection(config, encodeModelKey({
      providerId: 'provider-b', modelId: 'shared',
    }))).toEqual({ providerId: 'provider-b', modelId: 'shared' });
  });

  it('rejects a bare model id that exists under multiple providers', () => {
    expect(() => resolveDesktopModelSelection(config, 'shared'))
      .toThrow('无法唯一解析');
  });
});
