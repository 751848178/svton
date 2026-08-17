import { expect, test, type Page } from '@playwright/test';
import { seedE2e } from './helpers';
import {
  captureTranscriptEvidence,
  dispatchTranscriptState,
  installErrorHashes,
} from './transcript-accessibility.evidence';
import type { TranscriptFixtureStateId } from '../src/components/transcript-accessibility-fixture.data';

const ROUTE = '/e2e/transcript-accessibility';
const sizes = [
  { name: 'compact-320', width: 320, theme: 'theme-dark' },
  { name: 'compact-390', width: 390, theme: 'theme-dark' },
  { name: 'medium-768', width: 768, theme: 'theme-light' },
  { name: 'wide-1440', width: 1440, theme: 'theme-light' },
] as const;

test.describe('I08.3a transcript accessibility evidence', () => {
  test.describe.configure({ mode: 'serial' });

  test('responsive transcript and hover-hidden actions remain keyboard reachable', async ({ page }, info) => {
    const errors = installErrorHashes(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openFixture(page);
    for (const scenario of sizes) {
      await page.setViewportSize({ width: scenario.width, height: 900 });
      await dispatchTranscriptState(page, scenario.theme);
      await dispatchTranscriptState(page, 'restore-history');
      await dispatchTranscriptState(page, 'start-completed');
      await assertOnlyTopLiveOwner(page, 1);
      const interaction = scenario.width === 390 ? await verifyHoverAndKeyboardActions(page) : undefined;
      await captureTranscriptEvidence(page, info, scenario.name, {
        errors, expectedLiveOwners: 1, interaction,
        expectedReducedMotion: 'no-preference',
        expectedTargets: scenario.width === 390 ? [
          '[data-message-actions] button', '[data-testid="code-copy-action"]',
          '.svton-image-result-prompt-btn', '.svton-image-result-download-btn',
        ] : undefined,
      });
    }
  });

  test('run transitions announce once while deltas and stale session switches stay silent', async ({ page }, info) => {
    const errors = installErrorHashes(page);
    await page.setViewportSize({ width: 768, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openFixture(page);

    await dispatchTranscriptState(page, 'start-completed');
    await assertOnlyTopLiveOwner(page, 1);
    await captureTranscriptEvidence(page, info, 'running-no-preference', {
      errors, expectedLiveOwners: 1, expectedReducedMotion: 'no-preference',
    });
    await dispatchTranscriptState(page, 'token-delta');
    await assertOnlyTopLiveOwner(page, 0);
    await dispatchTranscriptState(page, 'progress-revision');
    await assertOnlyTopLiveOwner(page, 0);
    await dispatchTranscriptState(page, 'settle-completed');
    await assertTerminal(page, 'completed', 'polite');
    await captureTranscriptEvidence(page, info, 'terminal-completed', { errors, expectedLiveOwners: 1 });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await dispatchTranscriptState(page, 'start-failed');
    await assertOnlyTopLiveOwner(page, 1);
    await captureTranscriptEvidence(page, info, 'running-reduced-motion', {
      errors, expectedLiveOwners: 1, expectedReducedMotion: 'reduce',
    });
    await settleAndCapture(page, info, errors, 'failed');
    await settleAndCapture(page, info, errors, 'interrupted');
    await settleAndCapture(page, info, errors, 'cancelled');

    await dispatchTranscriptState(page, 'start-completed');
    await assertOnlyTopLiveOwner(page, 1);
    await dispatchTranscriptState(page, 'session-switch');
    await assertOnlyTopLiveOwner(page, 0);
    await captureTranscriptEvidence(page, info, 'session-switch-stale-silent', { errors, expectedLiveOwners: 0 });
  });
});

async function openFixture(page: Page) {
  await seedE2e(page, undefined, { memoryDisabled: true });
  await page.goto(ROUTE);
  await page.getByTestId('transcript-accessibility-fixture').waitFor();
  await expect(page.getByTestId('chat-status-announcer')).toHaveAttribute('data-announcement-sink', 'none');
  await assertOnlyTopLiveOwner(page, 0);
}

async function settleAndCapture(
  page: Page,
  info: import('@playwright/test').TestInfo,
  errors: ReturnType<typeof installErrorHashes>,
  status: 'failed' | 'interrupted' | 'cancelled',
) {
  const start = `start-${status}` as TranscriptFixtureStateId;
  const settle = `settle-${status}` as TranscriptFixtureStateId;
  if (await page.getByTestId('transcript-accessibility-fixture').getAttribute('data-state-id') !== start) {
    await dispatchTranscriptState(page, start);
    await assertOnlyTopLiveOwner(page, 1);
  }
  await dispatchTranscriptState(page, settle);
  await assertTerminal(page, status, 'assertive');
  if (status === 'failed') {
    const failure = page.locator('[data-timeline-status="failed"]');
    await expect(failure).toHaveCount(1);
    await expect(failure.getByTestId('command-stderr')).toHaveText(/\S/);
    await expect(failure.getByTestId('command-exit-code')).toHaveText('Exit code: 7');
  }
  await captureTranscriptEvidence(page, info, `terminal-${status}`, { errors, expectedLiveOwners: 1 });
}

async function assertTerminal(page: Page, status: string, sink: 'polite' | 'assertive') {
  const announcer = page.getByTestId('chat-status-announcer');
  await expect(announcer).toHaveAttribute('data-announcement-event-key', new RegExp(`:${status}$`));
  await expect(announcer).toHaveAttribute('data-announcement-sink', sink);
  await assertOnlyTopLiveOwner(page, 1);
}

async function assertOnlyTopLiveOwner(page: Page, expectedCount: number) {
  const readOwners = () => page.evaluate(() => {
    const explicit = Array.from(document.querySelectorAll<HTMLElement>('[aria-live="polite"], [aria-live="assertive"]'));
    const implicit = Array.from(document.querySelectorAll<HTMLElement>('[role="status"], [role="alert"]'))
      .filter((node) => !node.closest('[role="dialog"], [role="alertdialog"]'));
    return [...new Set([...explicit, ...implicit])].map((node) => node.dataset.testid ?? null);
  });
  await expect.poll(async () => (await readOwners()).length).toBe(expectedCount);
  if (expectedCount === 1) expect(await readOwners()).toEqual(['chat-status-announcer']);
}

async function verifyHoverAndKeyboardActions(page: Page) {
  const history = page.getByTestId('message-assistant').first();
  const actions = history.locator('[data-message-actions]');
  await expect.poll(() => actions.evaluate((node) => getComputedStyle(node).opacity)).toBe('0');
  await history.hover();
  await expect.poll(() => actions.evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
  await page.mouse.move(1, 1);
  const process = history.getByRole('button', { name: /Processed|已处理/ });
  await process.click();
  const fixtureImage = history.getByRole('img', { name: 'Synthetic image prompt' });
  await expect(fixtureImage).toHaveAttribute('src', /128x128.*2x.*\.png/);
  await expect(fixtureImage).toHaveJSProperty('naturalWidth', 256);
  await expect(fixtureImage).toHaveJSProperty('naturalHeight', 256);
  const prompt = history.locator('.svton-image-result-prompt-btn');
  await prompt.scrollIntoViewIfNeeded();
  await page.getByRole('log').focus();
  const box = await prompt.boundingBox();
  if (!box) throw new Error('Image prompt action is not laid out');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hiddenHit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.className ?? null, center);
  expect(hiddenHit ?? '').not.toContain('svton-image-result-prompt-btn');
  await process.focus();
  await page.keyboard.press('Tab');
  await expect(prompt).toBeFocused();
  await expect.poll(() => prompt.locator('..').evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
  const focusedHit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.className ?? null, center);
  expect(focusedHit).toContain('svton-image-result-prompt-btn');
  await page.keyboard.press('Enter');
  await expect(history.getByText('Synthetic image prompt')).toBeVisible();
  await page.keyboard.press('Tab');
  const download = history.locator('.svton-image-result-download-btn');
  await expect(download).toBeFocused();
  await page.keyboard.press('Tab');
  const codeCopy = history.getByTestId('code-copy-action');
  await expect(codeCopy).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(actions.getByRole('button', { name: /Copy|复制/ })).toBeFocused();
  return { hiddenImageCenterHit: false, focusedImageCenterHit: true, keyboardSequence: ['prompt', 'download', 'code-copy', 'message-copy'] };
}
