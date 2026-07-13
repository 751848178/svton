import { describe, expect, it } from 'vitest';
import { createAgent } from '../src/create-agent';
import type { CreateAgentConfig } from '../src/types';

function baseConfig(overrides: Partial<CreateAgentConfig> = {}): CreateAgentConfig {
  return {
    provider: {
      type: 'openai',
      apiKey: 'sk-test',
    },
    model: 'test-model',
    ...overrides,
  };
}

describe('createAgent web_search registration', () => {
  it('does not register web_search without a configured backend', async () => {
    const agent = await createAgent(baseConfig());

    expect(agent.toolRegistry.has('web_fetch')).toBe(true);
    expect(agent.toolRegistry.has('web_search')).toBe(false);
  });

  it('registers web_search with explicit search config', async () => {
    const agent = await createAgent(
      baseConfig({
        search: { provider: 'tavily', apiKey: 'tvly-test' },
      }),
    );

    expect(agent.toolRegistry.has('web_search')).toBe(true);
  });

  it('registers web_search with the Tavily shortcut', async () => {
    const agent = await createAgent(baseConfig({ searchApiKey: 'tvly-test' }));

    expect(agent.toolRegistry.has('web_search')).toBe(true);
  });

  it('registers web_search with a legacy endpoint shortcut', async () => {
    const agent = await createAgent(
      baseConfig({
        searchEndpoint: 'https://search.example.test',
      }),
    );

    expect(agent.toolRegistry.has('web_search')).toBe(true);
  });
});
