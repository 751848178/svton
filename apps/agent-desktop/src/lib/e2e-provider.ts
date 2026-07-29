/// <reference types="vite/client" />

import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  type AssistantMessage,
  type Provider,
} from '@svton/agent-core';
import type { SvtonConfig } from './config-store';

export const DESKTOP_E2E_MODEL = 'svton-desktop-e2e-model';
export const DESKTOP_E2E_MARKER = 'svton-desktop-e2e-marker';
export const DESKTOP_E2E_USER_MESSAGE = 'hello from the real desktop app';
export const DESKTOP_E2E_ASSISTANT_TEXT =
  `Real desktop streamed reply from the Pi runtime. [${DESKTOP_E2E_MARKER}]`;

const RESPONSE_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 20;
const RESPONSE_QUEUE = '__SVTON_DESKTOP_E2E_QUEUE__';

type E2eWindow = Window & { [RESPONSE_QUEUE]?: unknown[] };

export function desktopE2eActive(): boolean {
  return import.meta.env.VITE_SVTON_DESKTOP_E2E === '1';
}

export function desktopE2eTomlConfig(): SvtonConfig {
  return {
    model: { name: DESKTOP_E2E_MODEL, provider: 'e2e' },
    providers: {
      e2e: {
        type: 'openai',
        base_url: 'http://localhost:0',
        api_key: 'desktop-e2e-placeholder-not-a-secret',
        models: { [DESKTOP_E2E_MODEL]: 'Desktop E2E' },
      },
    },
  };
}

export function enqueueDesktopE2eResponse(): void {
  const queue = getResponseQueue();
  queue.push(fauxAssistantMessage([
    fauxText(DESKTOP_E2E_ASSISTANT_TEXT),
  ]));
}

export async function waitForDesktopE2eResponse(
  timeoutMs = RESPONSE_TIMEOUT_MS,
): Promise<AssistantMessage> {
  const deadline = Date.now() + timeoutMs;
  const queue = getResponseQueue();
  while (queue.length === 0) {
    if (Date.now() >= deadline) {
      throw new Error(`Desktop E2E faux response timed out after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return queue.shift() as AssistantMessage;
}

let cachedProvider: Provider | null = null;

export function getDesktopE2eModelsOverride(): { piProvider: Provider } | null {
  if (!desktopE2eActive()) return null;
  if (!cachedProvider) cachedProvider = createProvider();
  return { piProvider: cachedProvider };
}

function createProvider(): Provider {
  const handle = fauxProvider({
    api: 'openai-responses',
    provider: 'openai',
    models: [{ id: DESKTOP_E2E_MODEL, reasoning: true }],
    tokenSize: { min: 1_000_000, max: 1_000_000 },
  });
  const response = async (): Promise<AssistantMessage> => {
    handle.appendResponses([response]);
    return waitForDesktopE2eResponse();
  };
  handle.setResponses([response]);
  getResponseQueue();
  return handle.provider;
}

function getResponseQueue(): unknown[] {
  if (typeof window === 'undefined') {
    throw new Error('Desktop E2E provider requires a WKWebView window');
  }
  const e2eWindow = window as E2eWindow;
  if (!Array.isArray(e2eWindow[RESPONSE_QUEUE])) {
    e2eWindow[RESPONSE_QUEUE] = [];
  }
  return e2eWindow[RESPONSE_QUEUE];
}
