/**
 * agent-web REAL browser E2E — drives the actual product path through a real
 * Chromium page against a real Next.js dev process (see playwright.config.ts
 * `webServer`). No jsdom, no scripted ChatService; the real client-side agent
 * runs: AgentChat → initAgentConfig → ChatService → Pi runtime → React → DOM.
 *
 * A deterministic faux provider (src/lib/e2e-provider.ts) is injected via a
 * localStorage flag, so no real API key is needed, yet the full front↔event→UI
 * consumption chain is real. Responses are scripted live onto
 * `window.__SVTON_E2E_QUEUE__` from these tests.
 *
 * Together with chat-tool-product-path.spec.ts, covers W1–W10.
 */
import { test, expect } from '@playwright/test';
import {
  SHOTS,
  appReady,
  enqueueResponses,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';

test.describe('agent-web real browser E2E', () => {
  // Each test seeds its own E2E config (W4 passes a reasoning effort).

  // W1 — create session + first message; W2 — streaming content renders + settles idle.
  test('W1+W2: first message streams a reply and returns to idle', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [responses.text('Hello from the real browser path')]);
    await send(page, 'hi');
    await expect(lastAssistant(page)).toContainText('Hello from the real browser path', { timeout: 20_000 });
    await expect(page.getByTestId('send-button')).toBeVisible();
    await expect(page.getByTestId('stop-button')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/w1-w2-first-turn.png` });
  });

  // W3 — multi-turn in the same session.
  test('W3: multi-turn conversation in the same session', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [responses.text('turn one answer')]);
    await send(page, 'first question');
    await expect(lastAssistant(page)).toContainText('turn one answer', { timeout: 20_000 });

    await enqueueResponses(page, [responses.text('turn two answer')]);
    await send(page, 'follow up');
    await expect(lastAssistant(page)).toContainText('turn two answer', { timeout: 20_000 });
    await expect(page.getByTestId('message-user')).toHaveCount(2);
    await page.screenshot({ path: `${SHOTS}/w3-multi-turn.png` });
  });

  // W4 — thinking/reasoning content is shown (collapsible) per the model output.
  test('W4: thinking content renders and is expandable', async ({ page }) => {
    // reasoning effort 'medium' → thinkingLevel 'medium' → thinking streams.
    await seedE2e(page, 'medium');
    await appReady(page);
    await enqueueResponses(page, [responses.thinking('Let me reason step by step', 'Final answer here')]);
    await send(page, 'think carefully');
    await expect(lastAssistant(page)).toContainText('Final answer here', { timeout: 20_000 });
    // Thinking is a process block, collapsed under the "已处理" toggle by
    // default. Expand the process details to reveal the thinking block.
    await lastAssistant(page).getByText('已处理').click();
    const toggle = lastAssistant(page).getByTestId('thinking-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(lastAssistant(page).getByTestId('thinking-content')).toContainText('Let me reason step by step');
    await page.screenshot({ path: `${SHOTS}/w4-thinking.png` });
  });

  // W7 — user cancels a running generation.
  test('W7: abort cancels the in-flight stream and returns to idle', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    // No response queued → the faux provider's factory blocks the turn in flight
    // (it only resolves once a response is pushed); abort must cancel it.
    await send(page, 'long running');
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('stop-button').click();
    await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('stop-button')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/w7-abort.png` });
  });

  // W8 — provider/stream failure shows an error and the session recovers.
  test('W8: provider failure shows an error, then a retry succeeds', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [responses.error()]);
    await send(page, 'broken request');
    // The error block is a process block, collapsed under the "已处理" toggle.
    await lastAssistant(page).getByText('已处理').click().catch(() => {});
    await expect(page.getByTestId('message-error')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/w8-error.png` });

    await enqueueResponses(page, [responses.text('recovered after failure')]);
    await send(page, 'try again');
    await expect(lastAssistant(page)).toContainText('recovered after failure', { timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/w8-recovered.png` });
  });

  // W9 — page refresh reloads the prior session state (checkpoint restore).
  test('W9: page refresh rehydrates the prior conversation', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [responses.text('persisted across refresh')]);
    await send(page, 'remember this');
    await expect(lastAssistant(page)).toContainText('persisted across refresh', { timeout: 20_000 });

    // Real page reload: the runtime checkpoint (persisted in IndexedDB) is
    // restored on startup, rehydrating the prior conversation automatically.
    await page.reload();
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('message-assistant')).toContainText('persisted across refresh', { timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/w9-refresh-resume.png` });
  });

  // W10 — no secret leakage in page text, console logs, or network bodies.
  test('W10: no API key / secret leaks into page, console, or network', async ({ page }) => {
    await seedE2e(page);
    const consoleMsgs: string[] = [];
    page.on('console', (m) => consoleMsgs.push(`${m.type()}:${m.text()}`));
    const networkBodies: string[] = [];
    page.on('response', async (resp) => {
      try {
        const ct = resp.headers()['content-type'] ?? '';
        if (ct.includes('text') || ct.includes('json')) networkBodies.push(await resp.text());
      } catch { /* ignore */ }
    });
    await appReady(page);
    await enqueueResponses(page, [responses.text('clean response with no secrets')]);
    await send(page, 'hello');
    await expect(lastAssistant(page)).toContainText('clean response', { timeout: 20_000 });

    const sink = [await page.content(), ...consoleMsgs, ...networkBodies].join('\n');
    expect(sink).not.toContain('sk-ant-');
    expect(sink).not.toContain('sk-proj-');
    expect(sink).not.toContain('e2e-fake-key-not-a-secret');
    await page.screenshot({ path: `${SHOTS}/w10-no-leak.png` });
  });
});
