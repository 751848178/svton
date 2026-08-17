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
 * response factory drains that queue in order; an empty queue waits for the
 * next scripted response, and a queued `{ __error: true }` marker throws so
 * the test can exercise the provider-failure path (W8).
 *
 * This file ships with the bundle but is data-gated; it never touches secrets
 * and never runs unless a test explicitly opts in.
 */
import { fauxProvider, type AssistantMessage, type Provider, type PiProviderFamily } from '@svton/agent-core';
import { E2E_FLAG_KEY, E2E_QUEUE_GLOBAL, E2E_ERROR_MARKER, E2E_POST_TURN_PROMPT } from './e2e-constants';

export { E2E_FLAG_KEY, E2E_QUEUE_GLOBAL, E2E_ERROR_MARKER };

interface E2eFlag {
  modelId: string;
  modelIds?: string[];
  family?: PiProviderFamily;
  /** Optional initial reasoning effort to exercise the thinking show/hide path. */
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  memoryDisabled?: boolean;
  postTurnMemoryTimeoutMs?: number;
  startupFailureSource?: 'config' | 'chat' | 'session' | 'project';
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

export function isE2eMemoryDisabled(): boolean {
  return readFlag()?.memoryDisabled === true;
}

export function getE2ePostTurnMemoryTimeoutMs(): number | undefined {
  return readFlag()?.postTurnMemoryTimeoutMs;
}

export function getE2eStartupFailureSource(): E2eFlag['startupFailureSource'] {
  return readFlag()?.startupFailureSource;
}

/**
 * Read the next queued response from the page-global queue, waiting (polling)
 * if empty so the turn stays in-flight until the test scripts a response.
 * - normal AssistantMessage → returned
 * - `{ __error: true }` marker → throws (provider-failure simulation)
 * - empty queue → waits for a response to be enqueued (keeps the turn running,
 *   which is what the abort/failure tests need)
 */
interface AddressedE2eResponse {
  __prompt: string;
  response: AssistantMessage | { __error: true };
}

async function drainQueuedResponse(
  prompt: string | null,
  signal?: AbortSignal,
): Promise<AssistantMessage> {
  const w = window as unknown as Record<string, unknown[]>;
  const queuePrompt = isPostTurnPrompt(prompt) ? E2E_POST_TURN_PROMPT : prompt;
  let next: unknown;
  while (next === undefined) {
    const queue = w[E2E_QUEUE_GLOBAL];
    if (Array.isArray(queue)) {
      const index = queue.findIndex((item) => (
        isAddressed(item)
          ? item.__prompt === queuePrompt
          : queuePrompt !== E2E_POST_TURN_PROMPT
      ));
      if (index >= 0) {
        const selected = queue.splice(index, 1)[0];
        next = isAddressed(selected) ? selected.response : selected;
        break;
      }
    }
    await waitForQueuePoll(signal);
  }
  if (next && typeof next === 'object' && (next as { __error?: boolean }).__error) {
    throw new Error(E2E_ERROR_MARKER);
  }
  return next as AssistantMessage;
}

function isPostTurnPrompt(prompt: string | null): boolean {
  return prompt?.startsWith('Existing memory:\n') === true;
}

function isAddressed(value: unknown): value is AddressedE2eResponse {
  return !!value && typeof value === 'object' && typeof (value as AddressedE2eResponse).__prompt === 'string';
}

function latestUserPrompt(context: unknown): string | null {
  const record = context && typeof context === 'object' ? context as Record<string, unknown> : null;
  const messages = Array.isArray(context) ? context : record?.messages;
  if (!Array.isArray(messages)) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as Record<string, unknown> | undefined;
    if (message?.role !== 'user') continue;
    if (typeof message.content === 'string') return message.content;
    if (!Array.isArray(message.content)) return null;
    const text = message.content.flatMap((part) => {
      const item = part as Record<string, unknown>;
      return item.type === 'text' && typeof item.text === 'string' ? [item.text] : [];
    }).join('');
    return text || null;
  }
  return null;
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
      models: (flag.modelIds ?? [flag.modelId]).map((id) => ({ id, reasoning: true })),
      tokenSize: { min: 1_000_000, max: 1_000_000 },
    });
    type FauxStep = Parameters<typeof handle.setResponses>[0][number];
    type FauxFactory = Exclude<FauxStep, AssistantMessage>;
    // The faux provider shifts+consumes each queued step (faux.js). To keep it
    // alive across many turns without exhausting the queue, we register one
    // self-re-enqueuing factory that reads the live page-global queue (waiting
    // while empty so a turn stays in-flight until the test scripts a response).
    const factory: FauxFactory = async (context, options) => {
      handle.appendResponses([factory]);
      return drainQueuedResponse(latestUserPrompt(context), options?.signal);
    };
    handle.setResponses([factory]);
    cachedHandle = { piProvider: handle.provider };
  }
  return cachedHandle;
}
