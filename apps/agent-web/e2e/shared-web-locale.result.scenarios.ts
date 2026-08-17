import { expect, type Page } from '@playwright/test';
import {
  captureEvidence,
  type BrowserDiagnostics,
  type EvidenceAssertions,
  type EvidenceRecord,
} from './shared-web-locale.evidence';
import {
  resultFixture,
} from './shared-web-locale.seed';
import { seedLiveResultInputs } from './shared-web-locale.result-inputs';

export interface ResultLabels {
  code: 'en' | 'zh';
  addAttachment: string;
  referenceFile: string;
  controllerTooLarge: string;
  imageTooLarge: string;
  transcript: string;
  youMessage: string;
  assistantMessage: string;
  documentKind: string;
  open: string;
  artifactPanel: string;
  artifactOpened: string;
  preview: string;
  edit: string;
  closePanel: string;
  dirtyTitle: string;
  continueEditing: string;
  discardChanges: string;
  unsavedClose: string;
  readonlyLabel: string;
  openInHost: string;
  localPathUnsupported: string;
}

export async function runResultScenarios(
  page: Page,
  labels: ResultLabels,
  diagnostics: BrowserDiagnostics,
): Promise<EvidenceRecord[]> {
  const records: EvidenceRecord[] = [];
  await triggerControllerFileFailure(page, labels);
  records.push(await captureEvidence(page, labels.code, 'controller-file-failure', assertions({
    dom: ['controller result alert', `filename unchanged: ${resultFixture.controllerFile}`],
    error: [`alert: ${labels.controllerTooLarge}`], ax: [`alert: ${labels.controllerTooLarge}`],
  }), diagnostics));

  await triggerImageFailure(page, labels);
  records.push(await captureEvidence(page, labels.code, 'image-validation', assertions({
    dom: ['local image validation alert', `filename unchanged: ${resultFixture.imageFile}`],
    error: [`alert: ${labels.imageTooLarge}`], ax: [`alert: ${labels.imageTooLarge}`],
  }), diagnostics));

  await seedLiveResultInputs(page);
  await expect(page.getByRole('log', { name: labels.transcript })).toBeVisible();
  await expect(page.getByRole('article', { name: labels.youMessage })
    .filter({ hasText: '动态 transcript payload' })).toBeVisible();
  const assistants = page.getByRole('article', { name: labels.assistantMessage });
  await expect(assistants.first()).toBeVisible();
  const singleOutcome = page.locator(
    '[data-testid="timeline-file-outcome"][data-source-call-ids="uiimpl024-file-one"]',
  );
  await expect(singleOutcome).toHaveAttribute(
    'data-timeline-id', 'timeline:file:call:uiimpl024-file-one',
  );
  const turnOutcome = page.locator(
    '[data-testid="timeline-file-outcome"]'
      + '[data-source-call-ids="uiimpl024-turn-one uiimpl024-turn-two"]',
  );
  await expect(turnOutcome).toHaveAttribute('data-timeline-id', /^timeline:file:turn:/);
  const changePath = turnOutcome.getByText(resultFixture.changePath, { exact: true });
  await expect(changePath).toBeVisible();
  const disclosure = turnOutcome.locator('button[aria-controls]');
  await disclosure.click();
  const renderedDiff = await reconstructFirstDiff(turnOutcome);
  expect(renderedDiff).toBe(resultFixture.diff);
  const treeTool = page.getByTestId('timeline-tool-uiimpl024-tree');
  await expect(treeTool).toHaveAttribute('data-timeline-tool-name', 'list_files');
  await expect(treeTool.getByTestId('tool-result')).toContainText(resultFixture.treePath);
  const referenceTool = page.getByTestId('timeline-tool-uiimpl024-reference');
  await expect(referenceTool).toHaveAttribute('data-timeline-tool-name', 'file_read');
  await expect(referenceTool.getByTestId('tool-result')).toContainText('exact reference content');
  const referenceAssistant = assistants.filter({ has: referenceTool });
  await referenceAssistant.locator('button[aria-expanded]').first().click();
  const referenceTarget = referenceAssistant.getByTitle(resultFixture.treePath);
  await expect(referenceTarget).toHaveAttribute('title', resultFixture.treePath);
  records.push(await captureEvidence(page, labels.code, 'result-blocks-transcript', assertions({
    dom: ['timeline source IDs: uiimpl024-file-one, uiimpl024-turn-one, uiimpl024-turn-two, uiimpl024-tree, uiimpl024-reference',
      `path unchanged: ${resultFixture.changePath}`, `diff unchanged: ${resultFixture.diff}`,
      `raw tool/reference path unchanged: ${resultFixture.treePath}`],
    ax: [`log "${labels.transcript}"`, `article "${labels.youMessage}"`,
      `article "${labels.assistantMessage}"`],
  }), diagnostics));

  const documentButton = page.getByRole('button', { name: new RegExp(resultFixture.documentTitle) });
  await expect(documentButton.getByText(resultFixture.documentTitle, { exact: true })).toBeVisible();
  await expect(documentButton.locator('p')).toHaveText(
    `${resultFixture.documentSnippet} line-one-0 dynamic`,
  );
  await expect(documentButton).toContainText(labels.documentKind);
  await expect(documentButton).toContainText(resultFixture.documentSnippet);
  await expect(documentButton).toContainText(labels.open);
  records.push(await captureEvidence(page, labels.code, 'document-action', assertions({
    dom: [`title unchanged: ${resultFixture.documentTitle}`, `snippet unchanged: ${resultFixture.documentSnippet}`],
    ax: [`button "${labels.documentKind} ${resultFixture.documentTitle}`],
  }), diagnostics));

  await documentButton.click();
  const panel = page.getByRole('region', { name: labels.artifactPanel });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(resultFixture.documentTitle);
  await expect(panel.locator('[aria-live="polite"]')).toHaveText(labels.artifactOpened);
  records.push(await captureEvidence(page, labels.code, 'artifact-result', assertions({
    dom: [`title unchanged: ${resultFixture.documentTitle}`],
    live: [`polite: ${labels.artifactOpened}`],
    ax: [`region "${labels.artifactPanel}"`, `tab "${labels.preview}"`, `tab "${labels.edit}"`],
  }), diagnostics));

  await panel.getByRole('tab', { name: labels.edit }).click();
  const editor = panel.getByRole('textbox');
  await editor.fill('动态-draft-byte');
  await expect(editor).toHaveValue('动态-draft-byte');
  await panel.getByRole('button', { name: labels.closePanel }).click();
  const dialog = page.getByRole('alertdialog', { name: labels.dirtyTitle });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: labels.continueEditing })).toBeFocused();
  await expect(panel.locator('[aria-live="polite"]')).toHaveText(labels.unsavedClose);
  records.push(await captureEvidence(page, labels.code, 'artifact-dirty', assertions({
    dom: ['draft unchanged: 动态-draft-byte', `hidden result: ${labels.unsavedClose}`],
    focus: [labels.continueEditing],
    ax: [`alertdialog "${labels.dirtyTitle}"`, `button "${labels.continueEditing}"`, `button "${labels.discardChanges}"`],
  }), diagnostics));
  await dialog.getByRole('button', { name: labels.discardChanges }).click();
  await expect(panel).toHaveCount(0);

  await referenceTarget.click();
  const readonlyPanel = page.getByRole('region', { name: labels.artifactPanel });
  await expect(readonlyPanel.getByText(
    `${resultFixture.treePath}:${resultFixture.referenceLine}`, { exact: true },
  )).toBeVisible();
  await expect(readonlyPanel).toContainText(labels.readonlyLabel);
  await expect(readonlyPanel).toContainText(labels.localPathUnsupported);
  await expect(readonlyPanel.getByRole('button', { name: labels.openInHost })).toBeDisabled();
  records.push(await captureEvidence(page, labels.code, 'artifact-readonly', assertions({
    dom: [`reference unchanged: ${resultFixture.treePath}:${resultFixture.referenceLine}`],
    status: [labels.localPathUnsupported],
    ax: [`region "${labels.artifactPanel}"`, labels.readonlyLabel,
      `button "${labels.openInHost}" [disabled]`, labels.localPathUnsupported],
  }), diagnostics));
  return records;
}

async function triggerControllerFileFailure(page: Page, labels: ResultLabels) {
  await page.getByRole('button', { name: labels.addAttachment }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: labels.referenceFile }).click();
  await (await chooser).setFiles({
    name: resultFixture.controllerFile, mimeType: 'text/plain',
    buffer: Buffer.alloc(65 * 1024, 65),
  });
  await expect(page.getByTestId('composer-status')).toHaveText(labels.controllerTooLarge);
}

async function triggerImageFailure(page: Page, labels: ResultLabels) {
  await page.getByTestId('chat-input').evaluate((input, fixture) => {
    const file = new File([new Uint8Array(11 * 1024 * 1024)], fixture.imageFile, { type: 'image/png' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.closest('.relative')?.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, resultFixture);
  await expect(page.getByTestId('composer-status')).toHaveText(labels.imageTooLarge);
}

function assertions(partial: Partial<EvidenceAssertions>): EvidenceAssertions {
  return { dom: [], focus: [], keyboard: [], status: [], live: [], error: [], ax: [], ...partial };
}

async function reconstructFirstDiff(outcome: ReturnType<Page['locator']>): Promise<string> {
  return outcome.locator('table').first().locator('tbody tr').evaluateAll((rows) => (
    rows.map((row) => Array.from(row.querySelectorAll('td'))
      .map((cell) => cell.textContent ?? '').join('')).join('\n')
  ));
}
