import { expect, type Page } from '@playwright/test';
import { enqueueResponses, lastAssistant, responses, send } from './helpers';
import {
  captureEvidence,
  type BrowserDiagnostics,
  type EvidenceAssertions,
  type EvidenceRecord,
} from './shared-web-locale.evidence';

interface DecisionLabels {
  code: 'en' | 'zh';
  approvalTitle: string;
  cancel: string;
  decline: string;
  allowSession: string;
  allowOnce: string;
  cancelled: string;
  inputTitle: string;
  waiting: string;
  required: string;
  other: string;
  submit: string;
}

const questions = [
  {
    id: 'token', header: 'Access token', question: 'Enter a temporary token.',
    isOther: false, isSecret: true, options: null,
  },
  {
    id: 'theme', header: 'Theme', question: 'Choose a theme.',
    isOther: true, isSecret: false,
    options: [{ label: 'Blue', description: 'Use blue.' }],
  },
];

export async function runDecisionScenarios(
  page: Page,
  labels: DecisionLabels,
  diagnostics: BrowserDiagnostics,
): Promise<EvidenceRecord[]> {
  const records: EvidenceRecord[] = [];
  await enqueueResponses(page, [
    responses.toolCall('e2e_approval', { command: `locale-${labels.code}` }),
    responses.text(`approval ${labels.code} settled`),
  ]);
  await send(page, `approval ${labels.code}`);
  const approval = page.getByRole('alertdialog', { name: labels.approvalTitle });
  await expect(approval).toBeVisible({ timeout: 20_000 });
  const buttons = approval.getByRole('button');
  await expect(buttons).toHaveText([
    labels.cancel, labels.decline, labels.allowSession, labels.allowOnce,
  ]);
  await expect(approval.getByRole('button', { name: labels.cancel })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(approval.getByRole('button', { name: labels.allowOnce })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(approval.getByRole('button', { name: labels.cancel })).toBeFocused();
  records.push(await captureEvidence(page, labels.code, 'approval-pending', evidenceAssertions({
    dom: ['four ordered approval decisions'],
    focus: ['Cancel is initial and wrapped focus target'],
    keyboard: ['Shift+Tab and Tab wrap inside alertdialog'],
    status: ['approval waiting'], live: [], error: [],
    ax: [`alertdialog "${labels.approvalTitle}"`, ...[labels.cancel, labels.decline, labels.allowSession, labels.allowOnce].map((label) => `button "${label}"`)],
  }), diagnostics));
  await page.keyboard.press('Escape');
  await expect(approval).toHaveCount(0);
  await expect(lastAssistant(page)).toContainText(`approval ${labels.code} settled`, { timeout: 20_000 });
  await expect(page.getByTestId('approval-decision-history')).toHaveAttribute('data-status', 'cancelled');
  await expect(page.getByTestId('approval-decision-history')).toContainText(labels.cancelled);
  await expect(page.getByTestId('chat-input')).toBeFocused();
  records.push(await captureEvidence(page, labels.code, 'approval-settled', evidenceAssertions({
    dom: ['approval history retained'], focus: ['composer focus restored'],
    keyboard: ['Escape maps to cancel once'], status: [`history: ${labels.cancelled}`],
    live: ['settled assistant response visible'], error: [],
    ax: [labels.cancelled],
  }), diagnostics));

  await enqueueResponses(page, [
    responses.toolCall('request_user_input', { questions }),
    responses.text(`input ${labels.code} settled`),
  ]);
  await send(page, `input ${labels.code}`);
  const dialog = page.getByRole('dialog', { name: labels.inputTitle });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole('status')).toHaveText(labels.waiting);
  await expect(dialog.getByLabel('Access token')).toHaveAttribute('type', 'password');
  await dialog.getByRole('button', { name: labels.submit }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(2);
  await expect(dialog.getByRole('alert').first()).toHaveText(labels.required);
  await dialog.getByRole('radio', { name: labels.other, exact: true }).click();
  const otherAnswer = dialog.getByRole('textbox', { name: /Theme/ });
  await otherAnswer.fill('Green');
  await expect(dialog.getByRole('alert')).toHaveCount(1);
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  records.push(await captureEvidence(page, labels.code, 'request-input-required', evidenceAssertions({
    dom: ['two required questions', 'empty password input', 'Other answer selected'],
    focus: ['dialog owns focus'], keyboard: [], status: [`status: ${labels.waiting}`],
    live: ['required validation alert'], error: [`alert: ${labels.required}`],
    ax: [`dialog "${labels.inputTitle}"`, `status: ${labels.waiting}`, `radio "${labels.other}" [checked]`, `button "${labels.submit}"`, `alert: ${labels.required}`],
  }), diagnostics));
  await dialog.getByLabel('Access token').fill('evidence-token-fixture');
  await dialog.getByRole('button', { name: labels.submit }).click();
  await expect(dialog).toHaveCount(0);
  await expect(lastAssistant(page)).toContainText(`input ${labels.code} settled`, { timeout: 20_000 });
  await expect(page.locator('body')).not.toContainText('evidence-token-fixture');
  records.push(await captureEvidence(page, labels.code, 'request-input-settled', evidenceAssertions({
    dom: ['request dialog removed', 'secret absent from rendered transcript'],
    focus: ['composer focus restored'], keyboard: [], status: ['request settled'],
    live: ['assistant continuation visible'], error: [], ax: ['composer textbox', 'assistant message'],
  }), diagnostics));
  return records;
}

function evidenceAssertions(partial: Partial<EvidenceAssertions>): EvidenceAssertions {
  return { dom: [], focus: [], keyboard: [], status: [], live: [], error: [], ax: [], ...partial };
}
