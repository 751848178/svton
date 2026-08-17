import { describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import {
  ModelSwitchTransactionService,
  type ModelSwitchBindings,
  type ModelSwitchRequest,
  type PreparedModelConfig,
} from '@svton/agent-client';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  initAgent: vi.fn(),
}));

vi.mock('../src/lib/config-store', () => ({
  loadConfig: mocks.loadConfig,
  saveConfig: mocks.saveConfig,
}));
vi.mock('../src/lib/agent-setup', () => ({ initAgent: mocks.initAgent }));

import { createDesktopModelSwitchHost } from '../src/lib/desktop-model-switch-host';

const keyA = { providerId: 'provider-a', modelId: 'model-a' };
const keyB = { providerId: 'provider-b', modelId: 'model-b' };

describe('desktop model switch host', () => {
  it('invokes lossless config persistence only after the addressed runtime commits', async () => {
    const events: string[] = [];
    const platform = {} as TauriPlatform;
    const runtimeConfig = { model: 'model-b' } as AgentConfig;
    const diskConfig = {
      model: { provider: 'provider-a', name: 'model-a' },
      providers: {
        'provider-a': {
          type: 'openai', api: 'openai-responses', base_url: 'https://a',
          api_key: 'secret-a', models: { 'model-a': 'Model A' },
        },
        'provider-b': {
          type: 'openai', api: 'openai-completions', base_url: 'https://b',
          api_key: 'secret-b', models: { 'model-b': 'Model B' },
        },
      },
      extension: { preserve: true },
    };
    mocks.initAgent.mockResolvedValue({ kind: 'ready', config: runtimeConfig });
    mocks.loadConfig.mockResolvedValue({ config: diskConfig });
    mocks.saveConfig.mockImplementation(async () => { events.push('save'); });
    const host = createDesktopModelSwitchHost(platform, keyA);
    let active = keyA;
    const bindings: ModelSwitchBindings<PreparedModelConfig> = {
      active: () => active,
      persisted: host.getPersisted,
      blockedReason: () => null,
      prepare: host.prepareConfig,
      commit: (request) => { events.push('commit'); active = request.to; return true; },
      dispose: vi.fn(),
      persistDefault: (request, candidate) => host.persistDefault(request.to, candidate),
      commitPersistedDefault: vi.fn(),
      publishPhase: vi.fn(),
    };
    const request: ModelSwitchRequest = {
      requestId: 'desktop-b', sessionId: 'session-a', from: keyA, to: keyB,
      persistence: 'default-and-session',
    };

    await expect(new ModelSwitchTransactionService().execute(request, bindings))
      .resolves.toMatchObject({ kind: 'succeeded', active: keyB, persisted: keyB });
    expect(events).toEqual(['commit', 'save']);
    expect(mocks.saveConfig).toHaveBeenCalledWith(platform, {
      ...diskConfig,
      model: { provider: 'provider-b', name: 'model-b' },
    });
  });
});
