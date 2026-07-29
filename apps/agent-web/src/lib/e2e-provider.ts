/**
 * E2E faux-provider seam — production-safe injection point for real-browser
 * Playwright E2E (no real API key, deterministic scripted responses).
 *
 * Active ONLY when `localStorage['agent-web:e2e']` is set (a JSON object
 * `{ modelId: string; family?: 'openai'|'anthropic' }`). In every normal
 * (non-E2E) run that key is absent and {@link getE2eModelsOverride} returns
 * `null`, so this module is inert: no `fauxProvider` is constructed and
 * `agent-setup.ts` proceeds with the real provider exactly as before.
 *
 * When active, the page exposes `window.__SVTON_E2E_QUEUE__` — an array the
 * Playwright test pushes `AssistantMessage` objects onto (built via
 * `fauxAssistantMessage`/`fauxText`/`fauxToolCall`). The faux provider's
 * response factory drains that queue in order; an empty queue returns a
 * benign fallback message, and a queued `{ __error: true }` marker throws so
 * the test can exercise the provider-failure path (W8).
 *
 * This file ships with the bundle but is data-gated; it never touches secrets
 * and never runs unless a test explicitly opts in.
 */
import { fauxProvider, type AssistantMessage, type Provider, type PiProviderFamily } from '@svton/agent-core';
import { E2E_FLAG_KEY, E2E_QUEUE_GLOBAL, E2E_ERROR_MARKER } from './e2e-constants';

export { E2E_FLAG_KEY, E2E_QUEUE_GLOBAL, E2E_ERROR_MARKER };

interface E2eFlag {
  modelId: string;
  family?: PiProviderFamily;
  /** Optional initial reasoning effort to exercise the thinking show/hide path. */
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}

/** Read the E2E flag from localStorage (browser context only). */
function readFlag(): E2eFlag | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(E2E_FLAG_KEY);
    return raw ? (JSON.parse(raw) as E2eFlag) : null;
  } catch {
    return null;
  }
}

/**
 * Returns the initial `reasoningEffort` from the E2E flag, or `undefined`.
 * `agent-setup.ts` forwards it onto the AgentConfig so the runtime applies it
 * at creation (config-driven thinking show/hide).
 */
export function getE2eReasoningEffort(): E2eFlag['reasoningEffort'] | undefined {
  return readFlag()?.reasoningEffort;
}

/**
 * Read the next queued response from the page-global queue, waiting (polling)
 * if empty so the turn stays in-flight until the test scripts a response.
 * - normal AssistantMessage → returned
 * - `{ __error: true }` marker → throws (provider-failure simulation)
 * - empty queue → waits for a response to be enqueued (keeps the turn running,
 *   which is what the abort/failure tests need)
 */
async function drainQueuedResponse(signal?: AbortSignal): Promise<AssistantMessage> {
  const w = window as unknown as Record<string, unknown[]>;
  while (!Array.isArray(w[E2E_QUEUE_GLOBAL]) || w[E2E_QUEUE_GLOBAL].length === 0) {
    await waitForQueuePoll(signal);
  }
  const next = w[E2E_QUEUE_GLOBAL].shift();
  if (next && typeof next === 'object' && (next as { __error?: boolean }).__error) {
    throw new Error(E2E_ERROR_MARKER);
  }
  return next as AssistantMessage;
}

function waitForQueuePoll(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('E2E response wait aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (aborted: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (aborted) reject(new DOMException('E2E response wait aborted', 'AbortError'));
      else resolve();
    };
    const onAbort = () => finish(true);
    const timer = setTimeout(() => finish(false), 20);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

let cachedHandle: { piProvider: Provider } | null = null;

/**
 * Returns a `{ piProvider }` override when the E2E flag is set, else `null`.
 * `agent-setup.ts` merges this into `createPiModelsForProvider` options.
 */
export function getE2eModelsOverride(): { piProvider: Provider } | null {
  const flag = readFlag();
  if (!flag) return null;

  if (!cachedHandle) {
    const handle = fauxProvider({
      api: 'openai-responses',
      provider: 'openai',
      // `reasoning: true` is required so pi-ai streams thinking deltas
      // (models.js gates thinking on model.reasoning) — needed for W4.
      models: [{ id: flag.modelId, reasoning: true }],
      tokenSize: { min: 1_000_000, max: 1_000_000 },
    });
    type FauxStep = Parameters<typeof handle.setResponses>[0][number];
    type FauxFactory = Exclude<FauxStep, AssistantMessage>;
    // The faux provider shifts+consumes each queued step (faux.js). To keep it
    // alive across many turns without exhausting the queue, we register one
    // self-re-enqueuing factory that reads the live page-global queue (waiting
    // while empty so a turn stays in-flight until the test scripts a response).
    const factory: FauxFactory = async (_context, options) => {
      handle.appendResponses([factory]);
      return drainQueuedResponse(options?.signal);
    };
    handle.setResponses([factory]);
    cachedHandle = { piProvider: handle.provider };
  }
  return cachedHandle;
}
