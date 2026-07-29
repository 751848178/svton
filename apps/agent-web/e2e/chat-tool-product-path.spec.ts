/**
 * Real-browser approval and tool-progress paths through the Agent Web product.
 */
import { expect, test } from '@playwright/test';
import {
  SHOTS,
  appReady,
  enqueueResponses,
  lastAssistant,
  responses,
  seedE2e,
  send,
} from './helpers';

test.describe('agent-web tool approval and progress E2E', () => {
  test('W5: rejecting a tool keeps the session usable', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [
      responses.toolCall('memory_save', { content: 'remember this' }),
    ]);
    await send(page, 'remember something');
    await expect(page.getByTestId('tool-approve')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('tool-reject').click();
    await expect(page.getByTestId('tool-approve')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/w5-approval-reject.png` });
  });

  test('W5b: approving a tool completes the Pi turn', async ({ page }) => {
    await seedE2e(page);
    await appReady(page);
    await enqueueResponses(page, [
      responses.toolCall('memory_save', { content: 'approved memory' }),
      responses.text('approved tool completed'),
    ]);
    await send(page, 'remember with approval');
    await expect(page.getByTestId('tool-approve')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('tool-approve').click();
    await expect(page.getByTestId('tool-approve')).toHaveCount(0);
    await expect(lastAssistant(page)).toContainText(
      'approved tool completed',
      { timeout: 20_000 },
    );
    await expect(page.getByTestId('send-button')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/w5-approval-accept.png` });
  });

  test('W6: read-only tool progress settles completed', async ({ page }) => {
    await seedE2e(page);
    let releaseSearch = () => {};
    let markSearchStarted = () => {};
    const searchStarted = new Promise<void>((resolve) => {
      markSearchStarted = resolve;
    });
    const searchReleased = new Promise<void>((resolve) => {
      releaseSearch = resolve;
    });
    await page.route('**/*', async (route) => {
      if (!route.request().url().includes('search.test')) {
        return route.continue();
      }
      markSearchStarted();
      await searchReleased;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            title: 'Example',
            url: 'https://example.test/',
            content: 'example content',
          }],
        }),
      });
    });
    await appReady(page);
    await enqueueResponses(page, [
      responses.toolCall('web_search', { query: 'example' }),
      responses.text('Search completed successfully'),
    ]);
    await send(page, 'search example');
    await searchStarted;
    await lastAssistant(page).locator('button[title]').first().click();
    const toolCard = page.getByTestId('tool-card-web_search');
    await expect(toolCard).toHaveAttribute('data-tool-status', 'running');
    await expect(lastAssistant(page)).toContainText('Searching the web');
    releaseSearch();
    await expect(lastAssistant(page)).toContainText(
      'Search completed successfully',
      { timeout: 20_000 },
    );
    await expect(page.getByTestId('send-button')).toBeVisible({
      timeout: 20_000,
    });
    await lastAssistant(page).getByText('已处理').click().catch(() => {});
    await expect(toolCard).toBeVisible();
    await expect(toolCard).toHaveAttribute('data-tool-status', 'completed');
    await page.screenshot({
      path: `${SHOTS}/w6-tool-progress-success.png`,
    });
  });
});
