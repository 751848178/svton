import { expect, type Page } from '@playwright/test';
import { enqueueResponses, lastAssistant, responses, send } from './helpers';
import {
  captureEvidence,
  type BrowserDiagnostics,
  type EvidenceAssertions,
  type EvidenceRecord,
} from './shared-web-locale.evidence';
import {
  capturePopulatedSkillsScenario,
  type SkillAssetObservation,
  type SkillsAuxiliaryLabels,
} from './shared-web-locale.skills.scenario';

interface StateAuxiliaryLabels {
  kind: 'state';
  id: 'automation' | 'agents' | 'integrations';
  button: string;
  heading: string;
  state: string;
}

export interface LocaleLabels {
  code: 'en' | 'zh';
  html: 'en' | 'zh-CN';
  nav: string;
  placeholder: string;
  inputLabel: string;
  sendLabel: string;
  searchbox: string;
  manage: RegExp;
  menuFirst: string;
  auxiliary: ReadonlyArray<StateAuxiliaryLabels | SkillsAuxiliaryLabels>;
  settings: string;
  back: string;
  settingsCategory: string;
  marketplace: string;
  marketplaceLoading: string;
  marketplaceError: string;
}

export async function runShellScenarios(
  page: Page,
  labels: LocaleLabels,
  diagnostics: BrowserDiagnostics,
  skillAssets: SkillAssetObservation,
): Promise<EvidenceRecord[]> {
  const records: EvidenceRecord[] = [];
  const input = page.getByTestId('chat-input');
  await expect(page.locator('html')).toHaveAttribute('lang', labels.html);
  await expect(input).toHaveAttribute('placeholder', labels.placeholder);
  await expect(input).toBeEnabled();
  records.push(await captureEvidence(page, labels.code, 'composer-empty', assertions({
    dom: ['empty composer visible', `html lang=${labels.html}`, 'no horizontal overflow'],
    ax: [`combobox "${labels.inputLabel}"`],
  }), diagnostics));
  const sendButton = page.getByTestId('send-button');
  await expect(sendButton).toBeDisabled();
  records.push(await captureEvidence(page, labels.code, 'composer-disabled', assertions({
    dom: ['empty composer submit action disabled', 'no horizontal overflow'],
    ax: [`combobox "${labels.inputLabel}"`, `button "${labels.sendLabel}" [disabled]`],
  }), diagnostics));

  await enqueueResponses(page, [responses.text(`session ${labels.code} settled`)]);
  await send(page, `locale ${labels.code} session`);
  await expect(lastAssistant(page)).toContainText(`session ${labels.code} settled`, { timeout: 20_000 });
  const trigger = page.getByRole('button', { name: labels.nav });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Svton', exact: true });
  const search = drawer.getByRole('searchbox', { name: labels.searchbox });
  await search.fill(`locale ${labels.code}`);
  const row = drawer.getByTestId('session-item').filter({ hasText: `locale ${labels.code}` });
  await expect(row).toBeVisible();
  const manage = row.locator('..').getByRole('button', { name: labels.manage });
  await manage.click();
  const menuItems = page.getByRole('menuitem');
  await expect(menuItems).toHaveCount(4);
  await expect(menuItems.first()).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(menuItems.last()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menuItems.first()).toBeFocused();
  records.push(await captureEvidence(page, labels.code, 'session-search-menu', assertions({
    dom: ['search filters exact session', 'four management commands visible'],
    focus: ['first menu item focused'], keyboard: ['ArrowUp wraps last; ArrowDown wraps first'],
    ax: [`searchbox "${labels.searchbox}"`, `menuitem "${labels.menuFirst}"`],
  }), diagnostics));
  await page.setViewportSize({ width: 391, height: 844 });
  await expect(menuItems).toHaveCount(0);
  await expect(manage).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  records.push(await captureEvidence(page, labels.code, 'session-geometry-escape', assertions({
    dom: ['geometry close then immediate Escape closed drawer', 'no horizontal overflow'],
    focus: ['navigation trigger focused'], keyboard: ['immediate Escape reached drawer owner'],
    ax: [`button "${labels.nav}"`],
  }), diagnostics));

  for (const auxiliary of labels.auxiliary) {
    await trigger.click();
    await drawer.getByRole('button', { name: auxiliary.button, exact: true }).click();
    await expect(page.getByRole('heading', { name: auxiliary.heading, exact: true })).toBeVisible();
    if (auxiliary.kind === 'skills') {
      records.push(await capturePopulatedSkillsScenario(
        page, labels.code, auxiliary, diagnostics, skillAssets,
      ));
      continue;
    }
    await expect(page.getByText(auxiliary.state, { exact: true })).toBeVisible();
    records.push(await captureEvidence(page, labels.code, `aux-${auxiliary.id}`, assertions({
      dom: [`${auxiliary.heading} panel visible`, `deterministic state: ${auxiliary.state}`],
      ax: [`heading "${auxiliary.heading}"`, auxiliary.state],
    }), diagnostics));
  }
  return records;
}

export async function runSettingsScenarios(
  page: Page,
  labels: LocaleLabels,
  diagnostics: BrowserDiagnostics,
): Promise<EvidenceRecord[]> {
  const records: EvidenceRecord[] = [];
  const trigger = page.getByRole('button', { name: labels.nav });
  await trigger.click();
  await page.getByRole('dialog', { name: 'Svton' })
    .getByRole('button', { name: labels.auxiliary[1]!.button, exact: true }).click();
  const manageLink = page.getByRole('link', { name: labels.code === 'zh' ? '在设置中管理' : 'Manage in settings' });
  await expect(manageLink).toHaveAttribute('href', '/settings');
  await manageLink.click();
  await expect(page.getByRole('heading', { name: labels.settings })).toBeVisible();
  const category = page.getByRole('combobox', { name: labels.settingsCategory });
  await expect(category).toBeVisible();
  records.push(await captureEvidence(page, labels.code, 'settings-compact', assertions({
    dom: ['compact settings owns one category combobox', 'no horizontal overflow'],
    status: ['settings loaded'],
    ax: [`heading "${labels.settings}"`, `combobox "${labels.settingsCategory}"`],
  }), diagnostics));

  let releaseRequest!: () => void;
  const requestReleased = new Promise<void>((resolve) => { releaseRequest = resolve; });
  await page.route('https://skills.sh/api/v1/skills**', async (route) => {
    await requestReleased;
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await category.selectOption('marketplace');
  await expect(page.getByText(labels.marketplaceLoading, { exact: true })).toBeVisible();
  records.push(await captureEvidence(page, labels.code, 'settings-pending', assertions({
    dom: ['marketplace selected in compact settings'], keyboard: ['category selected by combobox'],
    status: [`pending text: ${labels.marketplaceLoading}`],
    ax: [`heading "${labels.marketplace}"`, labels.marketplaceLoading],
  }), diagnostics));
  releaseRequest();
  await expect(page.getByRole('alert')).toHaveText(labels.marketplaceError);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('navigation', { name: labels.settingsCategory })).toBeVisible();
  records.push(await captureEvidence(page, labels.code, 'settings-wide-error', assertions({
    dom: ['wide settings owns one category navigation'], live: ['error exposed as alert'],
    error: [`alert: ${labels.marketplaceError}`],
    ax: [`navigation "${labels.settingsCategory}"`, `alert: ${labels.marketplaceError}`],
  }), diagnostics));
  await page.getByRole('button', { name: labels.back, exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: labels.nav })).toBeVisible();
  records.push(await captureEvidence(page, labels.code, 'settings-back', assertions({
    dom: ['Next router Back returned to shell', 'no horizontal overflow'],
    ax: [`button "${labels.nav}"`],
  }), diagnostics));
  return records;
}

function assertions(partial: Partial<EvidenceAssertions>): EvidenceAssertions {
  return { dom: [], focus: [], keyboard: [], status: [], live: [], error: [], ax: [], ...partial };
}
