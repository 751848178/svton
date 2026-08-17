import type { Page } from '@playwright/test';

export const MODEL_KEYS = {
  initial: JSON.stringify({ providerId: 'provider-a', modelId: 'model-initial' }),
  slow: JSON.stringify({ providerId: 'provider-a', modelId: 'model-slow' }),
  fast: JSON.stringify({ providerId: 'provider-b', modelId: 'model-fast' }),
  failing: JSON.stringify({ providerId: 'provider-b', modelId: 'model-failing' }),
} as const;

export async function seedModelSwitchE2e(page: Page, options: {
  slowDelayMs?: number;
  failPrepare?: boolean;
  persistenceFailures?: number;
} = {}): Promise<void> {
  await page.addInitScript((seed) => {
    const providers = [
      {
        id: 'provider-a', name: 'Same Provider', type: 'openai',
        baseUrl: 'http://provider-a.invalid', apiKey: 'e2e-a',
        models: [
          { id: 'model-initial', name: 'Initial Model' },
          { id: 'model-slow', name: 'Shared Display' },
        ],
      },
      {
        id: 'provider-b', name: 'Same Provider', type: 'openai',
        baseUrl: 'http://provider-b.invalid', apiKey: 'e2e-b',
        models: [
          { id: 'model-fast', name: 'Shared Display' },
          { id: 'model-failing', name: 'Failing Model' },
        ],
      },
    ];
    if (!window.localStorage.getItem('agent-web:settings')) {
      window.localStorage.setItem('agent-web:settings', JSON.stringify({ providers }));
    }
    if (!window.localStorage.getItem('agent-web:defaultModel')) {
      window.localStorage.setItem('agent-web:defaultModel', JSON.stringify({
        providerId: 'provider-a', modelId: 'model-initial',
      }));
    }
    if (!window.localStorage.getItem('agent-web:e2e')) {
      window.localStorage.setItem('agent-web:e2e', JSON.stringify({
        modelId: 'model-initial',
        modelIds: ['model-initial', 'model-slow', 'model-fast', 'model-failing'],
        memoryDisabled: true,
        modelPrepareDelays: seed.slowDelayMs
          ? { 'model-slow': seed.slowDelayMs }
          : undefined,
        modelPrepareFailures: seed.failPrepare ? ['model-failing'] : undefined,
        modelPersistenceFailures: seed.persistenceFailures ?? 0,
      }));
    }
    const target = window as unknown as Record<string, unknown[]>;
    target.__SVTON_E2E_QUEUE__ = [];
  }, options);
}
