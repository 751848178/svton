import { expect, type Locator, type Page } from '@playwright/test';
import { captureComposerArtifactEvidence } from './composer-artifact-evidence.helpers';
import type {
  ArtifactLayoutName,
  PreservedUiState,
  ResponsiveBandName,
} from './composer-artifact-evidence.types';
import { enqueueResponses, lastAssistant, responses, send } from './helpers';
import type { BrowserDiagnostics } from './responsive-evidence.helpers';

const ARTIFACT_RESPONSE = `\`\`\`js\n${Array.from({ length: 180 }, (_, index) => (
  `console.log('original line ${index + 1}')`
)).join('\n')}\n\`\`\``;

export async function captureComposerArtifactAt(
  page: Page,
  name: string,
  band: ResponsiveBandName,
  layout: ArtifactLayoutName,
  diagnostics: BrowserDiagnostics,
  expectedState: PreservedUiState,
) {
  const host = page.locator('[data-responsive-artifact-host]');
  await expect(host).toHaveAttribute('data-artifact-band', band);
  await expect(host).toHaveAttribute('data-artifact-layout', layout);
  if (layout !== 'chat') await expect(page.locator('[data-artifact-heading]')).toHaveCount(1);
  return captureComposerArtifactEvidence(page, name, {
    expectedBand: band, expectedLayout: layout, diagnostics, expectedState,
  });
}

export async function prepareArtifact(page: Page) {
  await enqueueResponses(page, [responses.text(ARTIFACT_RESPONSE)]);
  await send(page, 'generate responsive artifact evidence');
  const opener = lastAssistant(page).getByRole('button', { name: 'Open content panel: js', exact: true });
  await expect(opener).toBeVisible({ timeout: 20_000 });
  return { opener };
}

export async function setOwnedScroll(locator: Locator, requested: number) {
  const value = await locator.evaluate((node, next) => {
    node.scrollTop = next;
    return node.scrollTop;
  }, requested);
  await locator.dispatchEvent('scroll');
  expect(value).toBeGreaterThan(0);
  return value;
}

export async function readTranscriptScroll(page: Page) {
  return page.locator('[role="log"]').evaluate((node) => ({
    top: node.scrollTop,
    fromBottom: Math.max(0, node.scrollHeight - node.clientHeight - node.scrollTop),
  }));
}

export async function attachTextFile(page: Page, name: string, text: string) {
  await page.getByRole('button', { name: '添加附件' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: '引用文件' }).click();
  await (await chooser).setFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
}
