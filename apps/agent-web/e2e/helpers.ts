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
import { E2E_QUEUE_GLOBAL, E2E_FLAG_KEY, E2E_ERROR_MARKER } from '../src/lib/e2e-constants';

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
  content: unknown[],
  stopReason = 'stop',
): Record<string, unknown> {
  return {
    role: 'assistant',
    content,
    api: 'openai-responses',
    provider: 'openai',
    model: 'e2e-test-model',
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
    stopReason,
    timestamp: Date.now(),
  };
}

/** A plain-text assistant response (streams as text, settles idle). */
const textResponse = (text: string) =>
  buildAssistantMessage([{ type: 'text', text }]);

/** A thinking + text assistant response. */
const thinkingResponse = (thinking: string, text: string) =>
  buildAssistantMessage([
    { type: 'thinking', thinking },
    { type: 'text', text },
  ]);

/** A response whose content includes a tool call (model requests a tool). */
const toolCallResponse = (toolName: string, args: Record<string, unknown>) =>
  buildAssistantMessage(
    // pi-ai ToolCall uses `type: "toolCall"` (camelCase), not `tool_call`.
    [{ type: 'toolCall', id: `tc-${Date.now()}`, name: toolName, arguments: args }],
    'tool_use',
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
): Promise<void> {
  await page.addInitScript((effort) => {
    const provider = {
      id: 'e2e',
      name: 'E2E Faux',
      type: 'openai',
      baseUrl: 'http://localhost:0',
      apiKey: 'e2e-fake-key-not-a-secret',
      models: [{ id: 'e2e-test-model', name: 'E2E Test Model' }],
    };
    window.localStorage.setItem('agent-web:settings', JSON.stringify([provider]));
    window.localStorage.setItem('agent-web:defaultModel', 'e2e::e2e-test-model');
    window.localStorage.setItem('agent-web:searchEndpoint', 'https://search.test/api');
    const flag: Record<string, unknown> = { modelId: 'e2e-test-model', family: 'openai' };
    if (effort) flag.reasoningEffort = effort;
    window.localStorage.setItem('agent-web:e2e', JSON.stringify(flag));
    // Preserve any queue a test pre-seeded before navigation; only init if absent.
    const w = window as unknown as Record<string, unknown[]>;
    if (!Array.isArray(w.__SVTON_E2E_QUEUE__)) w.__SVTON_E2E_QUEUE__ = [];
  }, reasoningEffort);
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

export const responses = {
  text: textResponse,
  thinking: thinkingResponse,
  toolCall: toolCallResponse,
  error: errorResponse,
};

export { E2E_ERROR_MARKER };
