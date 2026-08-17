import { expect, type Page } from '@playwright/test';
import { enqueueResponses, lastAssistant, responses, send } from './helpers';
import { buildResultDocumentFixture, resultFixture } from './shared-web-locale.seed';

/** Canonical provider/tool inputs traverse ChatService and production renderers. */
export async function seedLiveResultInputs(page: Page): Promise<void> {
  await enqueueResponses(page, [
    responses.toolCallWithId('file_edit', {
      path: resultFixture.changePath, diff: resultFixture.diff,
    }, 'uiimpl024-file-one'),
    responses.text('single file change settled'),
  ]);
  await send(page, '动态 transcript payload');
  await expect(lastAssistant(page)).toContainText('single file change settled', { timeout: 20_000 });

  await enqueueResponses(page, [
    responses.toolCallWithId('file_edit', {
      path: resultFixture.changePath, diff: resultFixture.diff,
    }, 'uiimpl024-turn-one'),
    responses.toolCallWithId('file_edit', {
      path: resultFixture.createdPath, diff: '+created-byte',
    }, 'uiimpl024-turn-two'),
    responses.text('turn diff settled'),
  ]);
  await send(page, 'produce two exact file changes');
  await expect(lastAssistant(page)).toContainText('turn diff settled', { timeout: 20_000 });

  await enqueueResponses(page, [
    responses.toolCallWithId('list_files', {
      tree: [{ name: resultFixture.treePath, type: 'file' }],
    }, 'uiimpl024-tree'),
    responses.text('file tree settled'),
  ]);
  await send(page, 'produce the exact file tree');
  await expect(lastAssistant(page)).toContainText('file tree settled', { timeout: 20_000 });

  await enqueueResponses(page, [
    responses.toolCallWithId('file_read', {
      path: resultFixture.treePath,
      offset: resultFixture.referenceLine,
      content: 'exact reference content',
    }, 'uiimpl024-reference'),
    responses.text('reference target settled'),
  ]);
  await send(page, 'produce the exact reference target');
  await expect(lastAssistant(page)).toContainText('reference target settled', { timeout: 20_000 });

  await enqueueResponses(page, [responses.text(buildResultDocumentFixture())]);
  await send(page, 'produce the exact structured document');
  await expect(lastAssistant(page).getByText(resultFixture.documentTitle, { exact: true }))
    .toBeVisible({ timeout: 20_000 });
}
