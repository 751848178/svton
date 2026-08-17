import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { appReady, send } from './helpers';
import { createReadySession } from './chat-approval-decision.helpers';

const ROOT = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/impl/i07-permission-reasoning';
const SHOTS = `${ROOT}/screenshots`;
const evidence: Array<Record<string, unknown>> = [];

test.describe.configure({ mode: 'serial' });

test.afterAll(() => {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${ROOT}/permission-reasoning-e2e.json`, JSON.stringify({
    contract: 'I07.2-permission-reasoning',
    generatedAt: new Date().toISOString(),
    scenarios: evidence,
  }, null, 2));
});

test('shares addressed controls with Settings, persists execution, and filters reasoning capabilities', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedPermissionE2e(page);
  await appReady(page);
  const execution = executionSelect(page);
  const reasoning = reasoningSelect(page);
  await expect(execution).toHaveValue('default');
  await expect(reasoning).toHaveValue('auto');
  await expect(reasoning.getByRole('option', { name: 'Auto（模型默认：High）', exact: true })).toHaveCount(1);
  await expect(reasoning.getByRole('option', { name: 'Low', exact: true })).toHaveCount(1);
  await expect(reasoning.getByRole('option', { name: 'High', exact: true })).toHaveCount(1);
  await expect(reasoning.getByRole('option', { name: 'Medium', exact: true })).toHaveCount(0);

  await execution.selectOption('accept_edits');
  await expect(execution).toHaveValue('accept_edits');
  await expectPersisted(page, 'accept_edits');
  await reasoning.selectOption('high');
  await expect(reasoning).toHaveValue('high');

  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('button', { name: '权限', exact: true }).click();
  await expect(executionSelect(page)).toHaveValue('accept_edits');
  await expect(reasoningSelect(page)).toHaveValue('high');
  await page.screenshot({ path: `${SHOTS}/settings-shared-values.png`, fullPage: true });
  await page.getByRole('button', { name: '返回' }).click();

  await page.reload();
  await page.getByTestId('chat-input').waitFor({ state: 'visible' });
  await expect(executionSelect(page)).toHaveValue('accept_edits');
  await expect(reasoningSelect(page)).toHaveValue('auto');
  evidence.push({
    scenario: 'success-settings-reload-capabilities', passed: true,
    activeExecution: 'accept_edits', persistedExecution: 'accept_edits',
    sessionReasoning: 'high', reloadReasoning: 'auto', defaultReasoning: 'high',
    screenshot: `${SHOTS}/settings-shared-values.png`,
  });
});

test('rolls runtime back and shows failure when durable permission persistence fails', async ({ page }) => {
  await seedPermissionE2e(page, { permissionPersistenceFailures: 1 });
  await appReady(page);
  const execution = executionSelect(page);
  await execution.selectOption('auto');

  await expect(page.getByRole('alert').filter({ hasText: 'E2E 执行配置持久化失败' }))
    .toContainText('当前会话已回滚到默认');
  await expect(execution).toHaveValue('default');
  await expectPersisted(page, 'default');
  await page.screenshot({ path: `${SHOTS}/persistence-failure-rollback.png`, fullPage: true });
  evidence.push({
    scenario: 'persistence-failure-rollback', passed: true,
    activeExecution: 'default', persistedExecution: 'default',
    screenshot: `${SHOTS}/persistence-failure-rollback.png`,
  });
});

test('keeps open A and B runtime settings isolated across navigation', async ({ page }) => {
  await seedPermissionE2e(page);
  await appReady(page);
  const promptA = 'permission isolation session A';
  const promptB = 'permission isolation session B';
  await createReadySession(page, promptA, 'session A ready');
  await reasoningSelect(page).selectOption('high');
  const sessionA = page.getByTestId('session-item').filter({ hasText: promptA });

  await page.getByRole('button', { name: '新对话' }).click();
  await createReadySession(page, promptB, 'session B ready');
  await reasoningSelect(page).selectOption('low');
  const sessionB = page.getByTestId('session-item').filter({ hasText: promptB });
  await expect(executionSelect(page)).toHaveValue('default');
  await expect(reasoningSelect(page)).toHaveValue('low');

  await sessionA.click();
  await expect(executionSelect(page)).toHaveValue('default');
  await expect(reasoningSelect(page)).toHaveValue('high');
  await executionSelect(page).selectOption('auto');
  await expectPersisted(page, 'auto');

  await sessionB.click();
  await expect(executionSelect(page)).toHaveValue('default');
  await expect(reasoningSelect(page)).toHaveValue('low');
  await sessionA.click();
  await expect(executionSelect(page)).toHaveValue('auto');
  await expect(reasoningSelect(page)).toHaveValue('high');
  await page.screenshot({ path: `${SHOTS}/ab-session-isolation.png`, fullPage: true });
  evidence.push({
    scenario: 'ab-session-isolation', passed: true,
    sessionA: { identity: promptA, execution: 'auto', reasoning: 'high' },
    sessionB: { identity: promptB, execution: 'default', reasoning: 'low' },
    persistedFutureDefault: 'auto',
    screenshot: `${SHOTS}/ab-session-isolation.png`,
  });
});

test('blocks both controls during an active turn without changing values or default', async ({ page }) => {
  await seedPermissionE2e(page);
  await appReady(page);
  const execution = executionSelect(page);
  const reasoning = reasoningSelect(page);
  await send(page, 'hold permission reasoning gate');
  await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 20_000 });

  await expect(execution).toBeDisabled();
  await expect(reasoning).toBeDisabled();
  await expect(execution).toHaveAttribute('title', /当前会话仍在运行/);
  await expect(reasoning).toHaveAttribute('title', /当前会话仍在运行/);
  await expect(execution).toHaveValue('default');
  await expect(reasoning).toHaveValue('auto');
  await expectPersisted(page, 'default');
  await page.screenshot({ path: `${SHOTS}/active-turn-gate.png`, fullPage: true });

  await page.getByTestId('stop-button').click();
  await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 20_000 });
  await expect(execution).toBeEnabled();
  await expect(reasoning).toBeEnabled();
  evidence.push({
    scenario: 'active-turn-gate', passed: true,
    execution: 'default', reasoning: 'auto', persistedFutureDefault: 'default',
    blockedReason: '当前会话仍在运行', recoveredAfterStop: true,
    screenshot: `${SHOTS}/active-turn-gate.png`,
  });
});

test('keeps both controls reachable with 44px targets at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPermissionE2e(page);
  await appReady(page);
  const execution = executionSelect(page);
  const reasoning = reasoningSelect(page);
  const executionBox = await execution.boundingBox();
  const reasoningBox = await reasoning.boundingBox();
  expect(executionBox?.height).toBeGreaterThanOrEqual(44);
  expect(reasoningBox?.height).toBeGreaterThanOrEqual(44);
  await execution.selectOption('plan');
  await expect(execution).toHaveValue('plan');
  await reasoning.selectOption('low');
  await expect(reasoning).toHaveValue('low');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/mobile-controls-390.png`, fullPage: true });
  evidence.push({
    scenario: 'mobile-reachability', viewport: '390x844', passed: true,
    executionHeight: executionBox?.height, reasoningHeight: reasoningBox?.height,
    screenshot: `${SHOTS}/mobile-controls-390.png`,
  });
});

function executionSelect(page: Page) {
  return page.getByRole('combobox', { name: 'Svton 执行配置' });
}

function reasoningSelect(page: Page) {
  return page.getByRole('combobox', { name: '推理强度' });
}

async function expectPersisted(page: Page, value: string): Promise<void> {
  await expect.poll(() => page.evaluate(() => (
    localStorage.getItem('agent-web:permissionMode') ?? 'default'
  ))).toBe(value);
}

async function seedPermissionE2e(page: Page, options: {
  permissionPersistenceFailures?: number;
} = {}): Promise<void> {
  await page.addInitScript((seed) => {
    const providers = [{
      id: 'e2e', name: 'E2E Faux', type: 'openai',
      baseUrl: 'http://localhost:0', apiKey: 'e2e-key',
      models: [{
        id: 'e2e-test-model', name: 'E2E Test Model',
        reasoningEfforts: ['low', 'high'], defaultReasoningEffort: 'high',
      }],
    }];
    localStorage.setItem('agent-web:settings', JSON.stringify({ providers }));
    localStorage.setItem('agent-web:defaultModel', JSON.stringify({
      providerId: 'e2e', modelId: 'e2e-test-model',
    }));
    if (!localStorage.getItem('agent-web:permissionMode')) {
      localStorage.setItem('agent-web:permissionMode', 'default');
    }
    if (!localStorage.getItem('agent-web:e2e')) {
      localStorage.setItem('agent-web:e2e', JSON.stringify({
        modelId: 'e2e-test-model', family: 'openai', memoryDisabled: true,
        permissionPersistenceFailures: seed.permissionPersistenceFailures ?? 0,
      }));
    }
    (window as unknown as Record<string, unknown[]>).__SVTON_E2E_QUEUE__ = [];
  }, options);
}
