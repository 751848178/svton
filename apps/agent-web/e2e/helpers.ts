/**
 * Playwright E2E helpers — drive the REAL agent-web client path with a
 * deterministic faux provider (no real API key).
 *
 * The app builds models in `src/lib/agent-setup.ts`; when
 * `localStorage['agent-web:e2e']` is set it installs a faux provider whose
 * responses are drained from `window.__SVTON_E2E_QUEUE__`. These helpers seed
 * that localStorage before first navigation and enqueue scripted responses
 * (built from real pi-ai `AssistantMessage` shapes) as the test runs.
 */
import type { Page } from '@playwright/test';
import type { AssistantMessage } from '@svton/agent-core';
import { E2E_QUEUE_GLOBAL, E2E_FLAG_KEY, E2E_ERROR_MARKER, E2E_POST_TURN_PROMPT } from '../src/lib/e2e-constants';

export const SHOTS = 'e2e/.screenshots';

export async function appReady(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('chat-input').waitFor({
    state: 'visible',
    timeout: 30_000,
  });
}

export async function send(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('send-button').click();
}

export const lastAssistant = (page: Page) => (
  page.getByTestId('message-assistant').last()
);

/**
 * Build an `AssistantMessage`-shaped object matching pi-ai's
 * `fauxAssistantMessage` output. Inlined here (rather than imported from
 * `@svton/agent-core`) so the Playwright Node-side harness does not pull the
 * pi-agent-core source graph through module resolution. These plain objects
 * serialize cleanly onto the page-global queue.
 */
function buildAssistantMessage(
  content: AssistantMessage['content'],
  stopReason: AssistantMessage['stopReason'] = 'stop',
  responseId?: string,
): AssistantMessage {
  return {
    role: 'assistant',
    content,
    api: 'openai-responses',
    provider: 'openai',
    model: 'e2e-test-model',
    responseId,
    // Pi's faux provider recalculates and overwrites this placeholder usage;
    // this builder is not a usage-fixture injection seam.
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason,
    timestamp: Date.now(),
  };
}

/** A plain-text assistant response (streams as text, settles idle). */
const textResponse = (text: string, responseId?: string) =>
  buildAssistantMessage([{ type: 'text', text }], 'stop', responseId);

/** A thinking + text assistant response. */
const thinkingResponse = (thinking: string, text: string, responseId?: string) =>
  buildAssistantMessage([
    { type: 'thinking', thinking },
    { type: 'text', text },
  ], 'stop', responseId);

/** A response whose content includes a tool call (model requests a tool). */
const toolCallResponse = (toolName: string, args: Record<string, unknown>, responseId?: string) =>
  toolCallResponseWithId(toolName, args, `tc-${Date.now()}`, responseId);

const toolCallResponseWithId = (
  toolName: string,
  args: Record<string, unknown>,
  callId: string,
  responseId?: string,
) =>
  buildAssistantMessage(
    // pi-ai ToolCall uses `type: "toolCall"` (camelCase), not `tool_call`.
    [{ type: 'toolCall', id: callId, name: toolName, arguments: args }],
    'toolUse',
    responseId,
  );

/** A response that triggers the provider-failure path (W8): stopReason 'error'. */
const errorResponse = () => {
  const msg = buildAssistantMessage([{ type: 'text', text: '' }], 'error');
  msg.errorMessage = 'Provider stream failed (simulated)';
  return msg;
};

/**
 * Seed localStorage BEFORE first navigation so the app boots straight into the
 * E2E faux-provider path. Uses addInitScript so it runs before any app code.
 *
 * NOTE: addInitScript serializes the callback, so it CANNOT reference imported
 * constants — all keys/values must be inlined as string literals here.
 *
 * @param reasoningEffort optional initial reasoning effort (exercises thinking
 *   show/hide). Omitted → 'off' (thinking hidden), the real default.
 */
export async function seedE2e(
  page: Page,
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh',
  options?: {
    memoryDisabled?: boolean;
    postTurnMemoryTimeoutMs?: number;
    startupFailureSource?: 'config' | 'chat' | 'session' | 'project';
  },
): Promise<void> {
  await page.addInitScript(({ effort, memoryDisabled, postTurnMemoryTimeoutMs, startupFailureSource }) => {
    // E2E settings belong to the app document, never sandboxed artifact srcdoc frames.
    if (window !== window.top) return;
    const provider = {
      id: 'e2e',
      name: 'E2E Faux',
      type: 'openai',
      baseUrl: 'http://localhost:0',
      apiKey: 'e2e-fake-key-not-a-secret',
      models: [{ id: 'e2e-test-model', name: 'E2E Test Model' }],
    };
    window.localStorage.setItem('agent-web:settings', JSON.stringify({ providers: [provider] }));
    window.localStorage.setItem('agent-web:defaultModel', JSON.stringify({
      providerId: 'e2e', modelId: 'e2e-test-model',
    }));
    window.localStorage.setItem('agent-web:searchEndpoint', 'https://search.test/api');
    const flag: Record<string, unknown> = { modelId: 'e2e-test-model', family: 'openai' };
    if (effort) flag.reasoningEffort = effort;
    if (memoryDisabled) flag.memoryDisabled = true;
    if (postTurnMemoryTimeoutMs !== undefined) {
      flag.postTurnMemoryTimeoutMs = postTurnMemoryTimeoutMs;
    }
    if (startupFailureSource) flag.startupFailureSource = startupFailureSource;
    window.localStorage.setItem('agent-web:e2e', JSON.stringify(flag));
    // Preserve any queue a test pre-seeded before navigation; only init if absent.
    const w = window as unknown as Record<string, unknown[]>;
    if (!Array.isArray(w.__SVTON_E2E_QUEUE__)) w.__SVTON_E2E_QUEUE__ = [];
  }, {
    effort: reasoningEffort,
    memoryDisabled: options?.memoryDisabled ?? false,
    postTurnMemoryTimeoutMs: options?.postTurnMemoryTimeoutMs,
    startupFailureSource: options?.startupFailureSource,
  });
}

/** Ensure the live queue array exists on the page. */
async function ensureQueue(page: Page): Promise<void> {
  await page.evaluate((globalName) => {
    const w = window as unknown as Record<string, unknown[]>;
    if (!Array.isArray(w[globalName])) w[globalName] = [];
  }, E2E_QUEUE_GLOBAL);
}

/** Enqueue one or more scripted responses for the next model call(s). */
export async function enqueueResponses(page: Page, responses: unknown[]): Promise<void> {
  await ensureQueue(page);
  await page.evaluate(
    ({ globalName, items }) => {
      const w = window as unknown as Record<string, unknown[]>;
      w[globalName].push(...items);
    },
    { globalName: E2E_QUEUE_GLOBAL, items: responses },
  );
}

/** Queue responses for one exact user prompt so concurrent runs cannot steal them. */
export async function enqueueResponsesForPrompt(
  page: Page,
  prompt: string,
  responses: unknown[],
): Promise<void> {
  await enqueueResponses(page, responses.map((response) => ({ __prompt: prompt, response })));
}

/** Queue hidden post-turn responses without exposing them to foreground prompts. */
export async function enqueuePostTurnResponses(
  page: Page,
  responses: unknown[],
): Promise<void> {
  await enqueueResponsesForPrompt(page, E2E_POST_TURN_PROMPT, responses);
}

export const responses = {
  text: textResponse,
  thinking: thinkingResponse,
  toolCall: toolCallResponse,
  toolCallWithId: toolCallResponseWithId,
  error: errorResponse,
};

export { E2E_ERROR_MARKER };
