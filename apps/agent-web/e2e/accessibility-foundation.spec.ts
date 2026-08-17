import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { appReady, lastAssistant, seedE2e } from './helpers';
import { openApproval } from './chat-approval-decision.helpers';

const SHOTS = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-foundation/screenshots';
const EVIDENCE = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i08-foundation/machine-evidence.json';
const machineEvidence: { generatedAt?: string; scenarios: Record<string, Record<string, unknown>> } = {
  scenarios: {},
};

test.describe('I08.1 accessibility foundation', () => {
  test.describe.configure({ mode: 'serial' });
  test.afterAll(async () => {
    machineEvidence.generatedAt = new Date().toISOString();
    await writeFile(EVIDENCE, `${JSON.stringify(machineEvidence, null, 2)}\n`, 'utf8');
  });

  test('global approval traps focus, inerts the app, ignores backdrop, and restores composer', async ({ page }) => {
    await openApproval(page, 'accessible approval', 'approval settled');
    const dialog = page.getByRole('alertdialog', { name: 'Approve this tool?' });
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const allow = dialog.getByRole('button', { name: 'Allow once' });
    await expect(cancel).toBeFocused();
    await expect.poll(() => appRootInert(page)).toBe(true);
    await expect(page.getByTestId('chat-pane-content')).not.toHaveAttribute('aria-hidden');
    const appInertDuringApproval = await appRootInert(page);
    const chatPaneAriaHidden = await page.getByTestId('chat-pane-content').getAttribute('aria-hidden');
    await page.keyboard.press('Shift+Tab');
    await expect(allow).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    await page.locator('[data-svton-modal-layer] > [aria-hidden="true"]').click({ position: { x: 4, y: 4 } });
    await expect(dialog).toBeVisible();
    await cancel.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(cancel).toBeFocused();
    const cancelFocusStyle = await cancel.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(cancelFocusStyle.outlineStyle).not.toBe('none');
    expect(Number.parseFloat(cancelFocusStyle.outlineWidth)).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/approval-keyboard-focus.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(lastAssistant(page)).toContainText('approval settled', { timeout: 20_000 });
    const decisionStatus = await page.getByTestId('approval-decision-history').getAttribute('data-status');
    expect(decisionStatus).toBe('cancelled');
    await expect.poll(() => appRootInert(page)).toBe(false);
    await expect(page.getByTestId('chat-input')).toBeFocused();
    machineEvidence.scenarios.globalApproval = {
      appInertDuringApproval,
      chatPaneAriaHidden,
      focusTrapSequence: ['Cancel', 'Allow once', 'Cancel'],
      backdropNoOp: true,
      focusedDecision: 'Cancel',
      focusOutline: cancelFocusStyle,
      escapeDecisionStatus: decisionStatus,
      appInertAfterSettlement: await appRootInert(page),
      restoredFocusTestId: await page.locator(':focus').getAttribute('data-testid'),
    };
  });

  test('no-cancel approval blocks Escape and exposes only allowed actions', async ({ page }) => {
    await seedE2e(page, undefined, { memoryDisabled: true });
    await page.goto('/e2e/accessibility');
    await page.getByTestId('accessibility-fixture').waitFor();
    const opener = page.getByRole('button', { name: 'Open no-cancel approval' });
    await opener.focus();
    await opener.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Decline' })).toBeFocused();
    const allowedActions = await dialog.getByRole('button').allTextContents();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await page.locator('[data-svton-modal-layer] > [aria-hidden="true"]').click({ position: { x: 4, y: 4 } });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Decline' }).click();
    const fixtureDecision = page.getByTestId('fixture-decision');
    await expect(fixtureDecision).toHaveText('no-cancel:decline');
    await expect(opener).toBeFocused();
    machineEvidence.scenarios.noCancelApproval = {
      allowedActions,
      initialFocus: 'Decline',
      escapeNoOp: true,
      backdropNoOp: true,
      decision: await fixtureDecision.textContent(),
      restoredFocus: await opener.textContent(),
    };
  });

  test('transcript announcements, visible focus, and reduced motion stay deterministic', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedE2e(page, undefined, { memoryDisabled: true });
    await page.goto('/e2e/accessibility');
    await page.getByTestId('accessibility-fixture').waitFor();
    const log = page.getByRole('log', { name: 'Conversation transcript' });
    await expect(log.getByRole('article')).toHaveCount(2);
    await expect(log.getByRole('article').first()).toHaveAccessibleName('You message');
    await expect(log.getByRole('article').last()).toHaveAccessibleName('Assistant message');
    const transcriptContract = await log.evaluate((element) => ({
      role: element.getAttribute('role'),
      label: element.getAttribute('aria-label'),
      live: element.getAttribute('aria-live'),
      relevant: element.getAttribute('aria-relevant'),
      atomic: element.getAttribute('aria-atomic'),
      tabIndex: element.getAttribute('tabindex'),
    }));
    const articleNames = await log.getByRole('article').evaluateAll((articles) => (
      articles.map((article) => article.getAttribute('aria-label'))
    ));
    const announcer = page.getByTestId('chat-status-announcer');
    await page.getByRole('button', { name: 'Append token' }).click();
    await expect(announcer).toBeEmpty();
    await expect(announcer).toHaveAttribute('data-announcement-sink', 'none');
    const status = page.locator('[data-transcript-state="running"]');
    await expect(status).toBeVisible();
    const workingStatusLabel = await status.getAttribute('aria-label');
    const durations = await status.evaluate((element) => {
      const style = getComputedStyle(element);
      const shimmer = element.querySelector('[data-svton-shimmer-label]');
      if (!(shimmer instanceof HTMLElement)) throw new Error('Missing shimmer label');
      const shimmerStyle = getComputedStyle(shimmer);
      return {
        shimmerAnimation: shimmerStyle.animationDuration,
        shimmerIterations: shimmerStyle.animationIterationCount,
        statusTransition: style.transitionDuration,
      };
    });
    expect(toMilliseconds(durations.shimmerAnimation)).toBeLessThanOrEqual(0.01);
    expect(maxIterationCount(durations.shimmerIterations)).toBeLessThanOrEqual(1);
    expect(toMilliseconds(durations.statusTransition)).toBeLessThanOrEqual(0.01);
    const modalMotion = await assertReducedMotionOverlay(page, 'modal');
    const drawerMotion = await assertReducedMotionOverlay(page, 'drawer');
    await page.screenshot({ path: `${SHOTS}/reduced-motion-working.png`, fullPage: true });
    await page.getByRole('button', { name: 'Complete run' }).click();
    await expect(announcer).toHaveText('Run completed.');
    await expect(announcer).toHaveAttribute('data-announcement-sink', 'polite');
    const completionAnnouncement = await announcer.textContent();
    await page.getByRole('button', { name: 'Start error run' }).click();
    await page.getByRole('button', { name: 'Surface error' }).click();
    await expect(announcer).toHaveText('Run failed. Review the visible error details.');
    await expect(announcer).toHaveAttribute('data-announcement-sink', 'assertive');
    expect(await announcer.textContent()).not.toContain('Deterministic provider failure');
    await expect(page.getByTestId('message-error')).toContainText('Deterministic provider failure');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    const focusContract = await focused.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        tagName: element.tagName,
        testId: element.getAttribute('data-testid'),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    expect(focusContract.outlineStyle).not.toBe('none');
    await page.screenshot({ path: `${SHOTS}/transcript-focus-visible.png`, fullPage: true });
    machineEvidence.scenarios.transcriptMotionAndAnnouncements = {
      transcript: transcriptContract,
      articleCount: articleNames.length,
      articleNames,
      tokenDeltaAnnouncement: '',
      workingStatusLabel,
      reducedMotion: durations,
      overlays: [modalMotion, drawerMotion],
      completionAnnouncement,
      completionAfterError: '',
      errorAnnouncement: await announcer.textContent(),
      visibleErrorDetailPreserved: true,
      focus: focusContract,
    };
  });
});

async function appRootInert(page: import('@playwright/test').Page): Promise<boolean> {
  return page.getByTestId('chat-input').evaluate((input) => {
    const root = Array.from(document.body.children).find((child) => child.contains(input));
    return Boolean((root as HTMLElement & { inert?: boolean } | undefined)?.inert);
  });
}

function toMilliseconds(duration: string): number {
  return Math.max(...duration.split(',').map((value) => {
    const parsed = Number.parseFloat(value);
    return value.trim().endsWith('ms') ? parsed : parsed * 1_000;
  }));
}

function maxIterationCount(iterations: string): number {
  return Math.max(...iterations.split(',').map((value) => value.trim() === 'infinite'
    ? Number.POSITIVE_INFINITY : Number.parseFloat(value)));
}

async function assertReducedMotionOverlay(
  page: import('@playwright/test').Page,
  kind: 'modal' | 'drawer',
): Promise<Record<string, string>> {
  await page.getByRole('button', { name: `Open shared ${kind}` }).click();
  const dialog = page.getByRole('dialog', { name: `Reduced-motion ${kind}` });
  await expect(dialog).toBeVisible();
  const layer = dialog.locator('xpath=ancestor::*[@data-svton-modal-layer]');
  const mask = layer.locator(':scope > [aria-hidden="true"]');
  const motion = await Promise.all([
    dialog.evaluate((element) => {
      const style = getComputedStyle(element);
      return { duration: style.animationDuration, iterations: style.animationIterationCount };
    }),
    mask.evaluate((element) => {
      const style = getComputedStyle(element);
      return { duration: style.animationDuration, iterations: style.animationIterationCount };
    }),
  ]);
  expect(motion.every(({ duration }) => toMilliseconds(duration) <= 0.01)).toBe(true);
  expect(motion.every(({ iterations }) => maxIterationCount(iterations) <= 1)).toBe(true);
  await dialog.getByRole('button', { name: `Close ${kind} fixture` }).click();
  await expect(dialog).toHaveCount(0);
  return {
    kind,
    panelAnimationDuration: motion[0].duration,
    panelAnimationIterations: motion[0].iterations,
    maskAnimationDuration: motion[1].duration,
    maskAnimationIterations: motion[1].iterations,
  };
}
