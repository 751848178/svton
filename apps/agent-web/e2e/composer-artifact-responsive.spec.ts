import { expect, test } from '@playwright/test';
import {
  attachTextFile,
  captureComposerArtifactAt,
  prepareArtifact,
  readTranscriptScroll,
  setOwnedScroll,
} from './composer-artifact-evidence.scenarios';
import { appReady, seedE2e } from './helpers';
import { installBrowserDiagnostics } from './responsive-evidence.helpers';

const LONG_COMPOSER_DRAFT = '请检查这个跨多行的长草稿，并保留附件、模型、会话设置和发送操作的位置。'.repeat(8);
const LONG_ARTIFACT_DRAFT = Array.from({ length: 220 }, (_, index) => (
  `console.log('preserved artifact line ${index + 1}')`
)).join('\n');

test.describe('composer and measured artifact runtime evidence', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2e(page, undefined, { memoryDisabled: true });
  });

  test('composer reflows slash, mention, attachment, and wrapped controls across the viewport matrix', async ({ page }) => {
    const diagnostics = installBrowserDiagnostics(page);
    await page.setViewportSize({ width: 320, height: 844 });
    await appReady(page);
    await attachTextFile(page, 'responsive-contract.txt', 'immutable attachment evidence');
    const input = page.getByTestId('chat-input');
    await input.fill(LONG_COMPOSER_DRAFT);
    await captureComposerArtifactAt(page, 'composer-320-attachment-wrapped', 'compact', 'chat', diagnostics, {
      composerValue: LONG_COMPOSER_DRAFT, attachmentCount: 1, popupVisible: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await input.fill('/he');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.locator('[data-testid="chat-pane-content"]').evaluate((node) => { node.scrollTop = 24; });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await captureComposerArtifactAt(page, 'composer-390-slash-scroll-resize', 'compact', 'chat', diagnostics, {
      composerValue: '/he', attachmentCount: 1, popupVisible: true,
    });

    await page.setViewportSize({ width: 768, height: 900 });
    await input.fill('@');
    await expect(page.getByRole('listbox')).toBeVisible();
    await captureComposerArtifactAt(page, 'composer-768-mention-reflow', 'medium', 'chat', diagnostics, {
      composerValue: '@', attachmentCount: 1, popupVisible: true,
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await input.fill(LONG_COMPOSER_DRAFT);
    await captureComposerArtifactAt(page, 'composer-1280-long-controls', 'wide', 'chat', diagnostics, {
      composerValue: LONG_COMPOSER_DRAFT, attachmentCount: 1, popupVisible: false,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await captureComposerArtifactAt(page, 'composer-1440-long-controls', 'wide', 'chat', diagnostics, {
      composerValue: LONG_COMPOSER_DRAFT, attachmentCount: 1, popupVisible: false,
    });
  });

  test('artifact preserves ownership and state through chat, single, split, focus transfer, cancel, and discard', async ({ page }) => {
    const diagnostics = installBrowserDiagnostics(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await appReady(page);
    const { opener } = await prepareArtifact(page);
    await setOwnedScroll(page.getByRole('log', { name: 'Conversation transcript' }), 180);
    await expect(page.getByRole('button', { name: /^(Scroll to bottom|回到底部)$/ })).toHaveCount(0);
    const initialScroll = await readTranscriptScroll(page);
    const chatScrollTop = initialScroll.top;
    await opener.click();
    const panel = page.getByRole('region', { name: '内容面板' });
    await expect(panel).toBeVisible();
    await captureComposerArtifactAt(page, 'artifact-390-preview-single', 'compact', 'artifact', diagnostics, {
      selectedTab: '预览', chatScrollTop, chatScrollFromBottom: initialScroll.fromBottom,
      chatAtBottom: initialScroll.fromBottom <= 1, focusPane: 'artifact',
    });

    await panel.getByRole('tab', { name: '编辑' }).click();
    const editor = panel.getByRole('textbox');
    await editor.fill(LONG_ARTIFACT_DRAFT);
    const artifactScrollTop = await setOwnedScroll(editor, 280);
    const closeSingle = panel.getByRole('button', {
      name: '返回对话并关闭内容面板', exact: true,
    });
    await closeSingle.click();
    const dialog = page.getByRole('alertdialog', { name: '放弃未保存更改？' });
    await expect(dialog).toBeVisible();
    await captureComposerArtifactAt(page, 'artifact-390-dirty-dialog', 'compact', 'artifact', diagnostics, {
      selectedTab: '编辑', editorValue: LONG_ARTIFACT_DRAFT,
      chatScrollTop, chatScrollFromBottom: initialScroll.fromBottom,
      chatAtBottom: initialScroll.fromBottom <= 1,
      artifactScrollTop, focusPane: 'artifact',
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(closeSingle).toBeFocused();

    await page.setViewportSize({ width: 768, height: 900 });
    await captureComposerArtifactAt(page, 'artifact-768-edit-single-preserved', 'medium', 'artifact', diagnostics, {
      selectedTab: '编辑', editorValue: LONG_ARTIFACT_DRAFT,
      chatScrollFromBottom: 0, chatAtBottom: true, artifactScrollTop, focusPane: 'artifact',
    });

    await page.setViewportSize({ width: 1024, height: 900 });
    await captureComposerArtifactAt(page, 'artifact-1024-wide-measured-single', 'wide', 'artifact', diagnostics, {
      selectedTab: '编辑', editorValue: LONG_ARTIFACT_DRAFT,
      chatScrollFromBottom: 0, chatAtBottom: true, artifactScrollTop, focusPane: 'artifact',
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    const composerDraft = 'composer draft retained while artifact is active';
    await page.getByTestId('chat-input').fill(composerDraft);
    await page.locator('[data-artifact-heading]').focus();
    await captureComposerArtifactAt(page, 'artifact-1280-split-preserved', 'wide', 'split', diagnostics, {
      composerValue: composerDraft, selectedTab: '编辑', editorValue: LONG_ARTIFACT_DRAFT,
      chatScrollFromBottom: 0, chatAtBottom: true, artifactScrollTop, focusPane: 'artifact',
    });

    await page.getByTestId('chat-input').focus();
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.locator('[data-artifact-heading]')).toBeFocused();
    await captureComposerArtifactAt(page, 'artifact-768-collapse-focus-transfer', 'medium', 'artifact', diagnostics, {
      composerValue: composerDraft, selectedTab: '编辑', editorValue: LONG_ARTIFACT_DRAFT,
      chatScrollFromBottom: 0, chatAtBottom: true, artifactScrollTop, focusPane: 'artifact',
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await captureComposerArtifactAt(page, 'artifact-1440-split-preserved', 'wide', 'split', diagnostics, {
      composerValue: composerDraft, selectedTab: '编辑', editorValue: LONG_ARTIFACT_DRAFT,
      chatScrollFromBottom: 0, chatAtBottom: true, artifactScrollTop, focusPane: 'artifact',
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await panel.getByRole('button', { name: '返回对话并关闭内容面板', exact: true }).click();
    await dialog.getByRole('button', { name: '放弃更改' }).click();
    await expect(panel).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect.poll(() => readTranscriptScroll(page)).toMatchObject({ fromBottom: 0 });
    expect((await readTranscriptScroll(page)).top).toBeGreaterThan(0);
    await captureComposerArtifactAt(page, 'artifact-390-discard-opener-restored', 'compact', 'chat', diagnostics, {
      composerValue: composerDraft, chatScrollFromBottom: 0, chatAtBottom: true,
      focusPane: 'chat', popupVisible: false,
    });
  });

  test('compact open and close restores the exact transcript scroll in unchanged geometry', async ({ page }) => {
    const diagnostics = installBrowserDiagnostics(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await appReady(page);
    const { opener } = await prepareArtifact(page);
    const chatScrollTop = await setOwnedScroll(page.getByRole('log', { name: 'Conversation transcript' }), 20);
    const expectedScroll = await readTranscriptScroll(page);
    await opener.click();
    const panel = page.getByRole('region', { name: '内容面板' });
    await expect(panel).toBeVisible();
    expect(await readTranscriptScroll(page)).toEqual(expectedScroll);
    await panel.getByRole('button', { name: '返回对话并关闭内容面板', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await readTranscriptScroll(page)).toEqual(expectedScroll);
    await captureComposerArtifactAt(page, 'artifact-390-close-scroll-exact', 'compact', 'chat', diagnostics, {
      chatScrollTop, chatScrollFromBottom: expectedScroll.fromBottom,
      chatAtBottom: expectedScroll.fromBottom <= 1,
      focusPane: 'chat', popupVisible: false,
    });
  });
});
