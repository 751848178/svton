import { expect, test } from '@playwright/test';
import {
  appReady,
  enqueueResponses,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i03-usage/browser';
const A_RESPONSE = 'Session A usage response.';
const B_RESPONSE = 'Session B usage response deliberately carries a much longer body for distinct output usage.';
const estimatedOutput = (text: string) => Math.ceil(text.length / 4);

async function usageLabel(page: Parameters<typeof lastAssistant>[0], output: number) {
  const label = page.getByText(new RegExp(`^[0-9.,k]+ in → ${output} out$`));
  await expect(label).toHaveCount(1);
  return label.textContent();
}

test.describe('I03.4 per-turn usage ownership', () => {
  test('session switch and reload retain each turn usage without drift', async ({ page }) => {
    await seedE2e(page, undefined, { memoryDisabled: true });
    await appReady(page);

    await enqueueResponses(page, [responses.text(A_RESPONSE, 'usage-session-a-response-1')]);
    await send(page, 'prepare usage session A');
    await expect(lastAssistant(page)).toContainText(A_RESPONSE);
    const sessionA = page.getByTestId('session-item').filter({ hasText: 'prepare usage session A' });
    await expect(sessionA).toBeVisible();
    await enqueueResponses(page, [responses.text('Session A following response.', 'usage-session-a-response-2')]);
    await send(page, 'following turn A');
    await expect(lastAssistant(page)).toContainText('Session A following response.');
    const labelA = await usageLabel(page, estimatedOutput(A_RESPONSE));
    if (!labelA) throw new Error('missing session A usage label');

    await page.getByRole('button', { name: '新对话' }).click();
    await enqueueResponses(page, [responses.text(B_RESPONSE, 'usage-session-b-response-1')]);
    await send(page, 'prepare usage session B');
    await expect(lastAssistant(page)).toContainText(B_RESPONSE);
    const sessionB = page.getByTestId('session-item').filter({ hasText: 'prepare usage session B' });
    await expect(sessionB).toBeVisible();
    await enqueueResponses(page, [responses.text('Session B following response.', 'usage-session-b-response-2')]);
    await send(page, 'following turn B');
    await expect(lastAssistant(page)).toContainText('Session B following response.');
    const labelB = await usageLabel(page, estimatedOutput(B_RESPONSE));
    if (!labelB) throw new Error('missing session B usage label');
    expect(labelB).not.toBe(labelA);
    await expect(page.getByText(labelA, { exact: true })).toHaveCount(0);

    await sessionA.click();
    await expect(page.getByText(labelA, { exact: true })).toHaveCount(1);
    await expect(page.getByText(labelB, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/01-session-a-switched.png`, fullPage: true });

    await page.reload();
    await page.getByTestId('chat-input').waitFor({ state: 'visible', timeout: 30_000 });
    await sessionA.click();
    await expect(page.getByText(labelA, { exact: true })).toHaveCount(1);
    await expect(page.getByText(labelB, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/02-session-a-reloaded.png`, fullPage: true });

    await sessionB.click();
    await expect(page.getByText(labelB, { exact: true })).toHaveCount(1);
    await expect(page.getByText(labelA, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/03-session-b-restored.png`, fullPage: true });
  });
});
