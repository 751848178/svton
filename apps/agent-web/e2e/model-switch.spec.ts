import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { appReady, send } from './helpers';
import { MODEL_KEYS, seedModelSwitchE2e } from './model-switch.helpers';

const ROOT = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i07-model-switch';
const SHOTS = `${ROOT}/screenshots`;
const evidence: Array<Record<string, unknown>> = [];

test.describe.configure({ mode: 'serial' });

test.afterAll(() => {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${ROOT}/model-switch-e2e.json`, JSON.stringify({
    contract: 'I07.1-model-switch',
    generatedAt: new Date().toISOString(),
    scenarios: evidence,
  }, null, 2));
});

test('commits provider-qualified runtime, preserves draft, shares settings, and reloads', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedModelSwitchE2e(page);
  await appReady(page);
  const composer = modelSelect(page, 'composer');
  await expect(composer).toHaveValue(MODEL_KEYS.initial);
  await page.getByTestId('chat-input').fill('draft survives model switch');
  await composer.selectOption(MODEL_KEYS.fast);
  await expect(composer).toHaveValue(MODEL_KEYS.fast);
  await expect(page.getByTestId('model-selector-composer')).toContainText('已切换并保存');
  await expect(page.getByTestId('chat-input')).toHaveValue('draft survives model switch');
  await expectPersisted(page, MODEL_KEYS.fast);

  await page.getByRole('button', { name: '设置' }).click();
  const settings = modelSelect(page, 'settings');
  await expect(settings).toHaveValue(MODEL_KEYS.fast);
  await expect(settings.locator('optgroup[label="Same Provider (provider-a)"]')).toHaveCount(1);
  await expect(settings.locator('optgroup[label="Same Provider (provider-b)"]')).toHaveCount(1);
  await expect(settings.getByRole('option', {
    name: '(provider-b) Shared Display — Same Provider',
  })).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/desktop-settings-shared-control.png`, fullPage: true });
  await page.getByRole('button', { name: '返回' }).click();

  await page.reload();
  await page.getByTestId('chat-input').waitFor({ state: 'visible' });
  await expect(modelSelect(page, 'composer')).toHaveValue(MODEL_KEYS.fast);
  evidence.push({
    scenario: 'success-settings-reload', viewport: '1280x800', passed: true,
    committed: MODEL_KEYS.fast, runtime: MODEL_KEYS.fast, persisted: MODEL_KEYS.fast,
    screenshot: `${SHOTS}/desktop-settings-shared-control.png`,
  });
});

test('keeps active/default split honest across prepare and persistence failures', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedModelSwitchE2e(page, { failPrepare: true, persistenceFailures: 1 });
  await appReady(page);
  const selectorRoot = page.getByTestId('model-selector-composer');
  const composer = modelSelect(page, 'composer');
  await composer.selectOption(MODEL_KEYS.failing);
  await expect(page.getByTestId('model-selector-composer').getByRole('alert'))
    .toContainText('E2E 模型准备失败');
  await expect(composer).toHaveValue(MODEL_KEYS.initial);
  await page.screenshot({ path: `${SHOTS}/prepare-failure-rollback.png`, fullPage: true });
  await page.getByRole('button', { name: '关闭状态' }).click();

  await composer.selectOption(MODEL_KEYS.fast);
  await expect(selectorRoot.getByRole('alert'))
    .toContainText('持久默认仍为');
  expect((await selectorRoot.getByRole('alert').boundingBox())?.width)
    .toBeGreaterThanOrEqual(480);
  await expect(composer).toHaveValue(MODEL_KEYS.fast);
  await expectPersisted(page, MODEL_KEYS.initial);
  await page.screenshot({ path: `${SHOTS}/persistence-active-default-split.png`, fullPage: true });
  await page.getByRole('button', { name: '重试保存默认模型' }).click();
  await expect(page.getByTestId('model-selector-composer')).toContainText('默认模型已保存');
  await expectPersisted(page, MODEL_KEYS.fast);
  await page.screenshot({ path: `${SHOTS}/persistence-retry-succeeded.png`, fullPage: true });
  evidence.push({
    scenario: 'prepare-failure-persistence-retry', passed: true,
    rollbackCommitted: MODEL_KEYS.initial, rollbackRuntime: MODEL_KEYS.initial,
    splitCommitted: MODEL_KEYS.fast, splitRuntime: MODEL_KEYS.fast,
    splitPersisted: MODEL_KEYS.initial, retryPersisted: MODEL_KEYS.fast,
    screenshots: [
      `${SHOTS}/prepare-failure-rollback.png`,
      `${SHOTS}/persistence-active-default-split.png`,
      `${SHOTS}/persistence-retry-succeeded.png`,
    ],
  });
});

test('newer fast preparation wins a delayed race without optimistic selection', async ({ page }) => {
  await seedModelSwitchE2e(page, { slowDelayMs: 700 });
  await appReady(page);
  const composer = modelSelect(page, 'composer');
  await page.getByTestId('chat-input').fill('race draft');
  await composer.selectOption(MODEL_KEYS.slow);
  await expect(page.getByTestId('model-selector-composer')).toContainText('正在准备');
  await expect(composer).toHaveValue(MODEL_KEYS.initial);
  await composer.selectOption(MODEL_KEYS.fast);
  await expect(composer).toHaveValue(MODEL_KEYS.fast);
  await page.waitForTimeout(900);
  await expect(composer).toHaveValue(MODEL_KEYS.fast);
  await expect(page.getByTestId('model-selector-composer')).toContainText('Shared Display');
  await expect(page.getByTestId('chat-input')).toHaveValue('race draft');
  await expectPersisted(page, MODEL_KEYS.fast);
  evidence.push({
    scenario: 'latest-request-wins', delayMs: 700, passed: true,
    committed: MODEL_KEYS.fast, runtime: MODEL_KEYS.fast, persisted: MODEL_KEYS.fast,
  });
});

test('blocks switching during an active turn and keeps the committed model', async ({ page }) => {
  await seedModelSwitchE2e(page);
  await appReady(page);
  const composer = modelSelect(page, 'composer');
  await send(page, 'hold model switch gate');
  await expect(page.getByTestId('stop-button')).toBeVisible();
  const alternate = await composer.locator('option:not(:disabled)').nth(1).getAttribute('value');
  expect(alternate).toBeTruthy();
  await composer.selectOption(alternate!);
  await expect(page.getByTestId('model-selector-composer').getByRole('alert'))
    .toContainText('仍在运行');
  await expect(composer).toHaveValue(MODEL_KEYS.initial);
  await expectPersisted(page, MODEL_KEYS.initial);
  await page.screenshot({ path: `${SHOTS}/active-turn-switch-blocked.png`, fullPage: true });
  await page.getByTestId('stop-button').click();
  await expect(page.getByTestId('send-button')).toBeVisible();
  evidence.push({
    scenario: 'active-turn-gate', passed: true,
    committed: MODEL_KEYS.initial, runtime: MODEL_KEYS.initial, persisted: MODEL_KEYS.initial,
    screenshot: `${SHOTS}/active-turn-switch-blocked.png`,
  });
});

test('keeps the composer switch control reachable at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedModelSwitchE2e(page);
  await appReady(page);
  const selectorRoot = page.getByTestId('model-selector-composer');
  const composer = modelSelect(page, 'composer');
  await expect(composer).toBeVisible();
  const box = await composer.boundingBox();
  const selectorBox = await selectorRoot.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(240);
  expect(selectorBox?.width).toBeGreaterThanOrEqual(240);
  expect((box?.x ?? -1) + (box?.width ?? 999)).toBeLessThanOrEqual(390);
  await composer.selectOption(MODEL_KEYS.fast);
  await expect(composer).toHaveValue(MODEL_KEYS.fast);
  await expect(composer.locator('option:checked')).toContainText('(provider-b)');
  const status = selectorRoot.getByRole('status');
  await expect(status).toBeVisible();
  expect((await status.boundingBox())?.width).toBeGreaterThanOrEqual(240);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/mobile-composer-390.png`, fullPage: true });
  evidence.push({
    scenario: 'mobile-reachability', viewport: '390x844', targetHeight: box?.height,
    selectorWidth: box?.width, statusWidth: (await status.boundingBox())?.width,
    committed: MODEL_KEYS.fast, runtime: MODEL_KEYS.fast, persisted: MODEL_KEYS.fast,
    screenshot: `${SHOTS}/mobile-composer-390.png`, passed: true,
  });
});

function modelSelect(page: Page, variant: 'composer' | 'settings') {
  return page.getByTestId(`model-selector-${variant}`).getByRole('combobox');
}

async function expectPersisted(page: Page, expected: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => (
    window.localStorage.getItem('agent-web:defaultModel')
  ))).toBe(expected);
}
