import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator, LocaleProvider, type Locale } from '@svton/ui';
import { ArtifactPanel } from '../src/components/artifacts/ArtifactPanel';
import { ArtifactEditableView } from '../src/components/artifacts/ArtifactEditableView';
import { ArtifactReadonlyView } from '../src/components/artifacts/ArtifactReadonlyView';
import type { ArtifactInteraction } from '../src/components/artifacts/artifact.types';
import { ChatInput } from '../src/components/chat/ChatInput';
import { ChatPanel, type ChatPanelMessage } from '../src/components/chat/ChatPanel';
import { CodeReviewBlock } from '../src/components/chat/CodeReviewBlock';
import { DocumentCard } from '../src/components/chat/DocumentCard';
import { FileChangeView } from '../src/components/chat/blocks/FileChangeView';
import { FileTreeBlockView } from '../src/components/chat/blocks/FileTreeBlockView';
import { TurnDiffView } from '../src/components/chat/blocks/TurnDiffView';

const localeRender = (locale: Locale, child: ReactNode) => render(
  <LocaleProvider locale={locale}>{child}</LocaleProvider>,
);
const messages: ChatPanelMessage[] = [
  { id: 'user-dynamic', role: 'user', content: '动态 transcript payload' },
  { id: 'assistant-dynamic', role: 'assistant', content: 'assistant byte payload' },
];
function interaction(reason = 'HOST-原因-byte'): ArtifactInteraction {
  const target = {
    kind: 'document' as const, id: 'dynamic-doc', title: '动态-title',
    format: 'markdown' as const, content: '动态-content',
  };
  return {
    state: {
      active: { target, baseline: 'source', draft: 'dynamic-draft', draftState: 'dirty' },
      confirmation: { kind: 'close' },
      result: { id: 'dirty-result', kind: 'cancelled', message: 'dynamic-result' },
      pending: false,
    },
    createOperationId: () => 'operation-byte', dispatch: vi.fn(async () => ({ id: 'operation-byte', kind: 'succeeded' })),
    updateDraft: vi.fn(), resolveOpenCapability: () => ({ supported: false, reason }),
  };
}

describe.each(['en', 'zh'] as const)('%s shared result presenters', (locale) => {
  const t = createTranslator(locale);

  it('localizes transcript, artifact dialog, result region, and readonly capability shell', () => {
    const transcript = localeRender(locale, <ChatPanel messages={messages} onSend={vi.fn()} />);
    expect(screen.getByRole('log', { name: t('chat.transcript.label') })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: t('chat.message.label', { author: t('chat.author.you') }) }))
      .toHaveTextContent('动态 transcript payload');
    expect(screen.getByRole('article', { name: t('chat.message.label', { author: t('chat.author.assistant') }) }))
      .toHaveTextContent('assistant byte payload');
    transcript.unmount();

    const panel = localeRender(locale, <ArtifactPanel interaction={interaction()} />);
    expect(screen.getByLabelText(t('artifact.panel.label'))).toHaveTextContent('动态-title');
    expect(screen.getByRole('alertdialog', { name: t('artifact.dirty.title') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('artifact.dirty.continue') })).toBeInTheDocument();
    expect(screen.getByText('dynamic-result')).toBeInTheDocument();
    panel.unmount();

    const readonly = interaction();
    const readonlyView = localeRender(locale, <ArtifactReadonlyView
      target={{ kind: 'file', id: 'dynamic-file', path: '/动态/path.ts', line: 42, source: 'tree' }}
      interaction={readonly}
    />);
    expect(screen.getByText(t('artifact.readonly.label'))).toBeInTheDocument();
    expect(screen.getByText('/动态/path.ts:42')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('artifact.openInHost') })).toBeDisabled();
    expect(screen.getByText('HOST-原因-byte')).toBeInTheDocument();
    readonlyView.unmount();
    localeRender(locale, <ArtifactEditableView
      target={{ kind: 'document', id: 'one-character', title: 'Dynamic title', format: 'markdown', content: 'x' }}
      draft="x" mode="edit" onChange={vi.fn()}
      previewTabId="preview-tab" previewPanelId="preview-panel" editTabId="edit-tab" editPanelId="edit-panel"
    />);
    expect(screen.getByText(t('artifact.charactersOne'))).toBeInTheDocument();
  });

  it('localizes image validation without changing the dynamic filename', async () => {
    localeRender(locale, <ChatInput onSend={vi.fn()} />);
    const image = { name: '动态-image.png', type: 'image/png', size: 11 * 1024 * 1024 } as File;
    fireEvent.drop(screen.getByTestId('chat-input').closest('.relative')!, { dataTransfer: { files: [image] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(t('chat.composer.image.tooLarge', { name: image.name }));
  });

  it('localizes file, diff, tree, document, and review actions while preserving payloads', () => {
    const open = vi.fn();
    const changes = [{ path: '/动态/src/exact.ts', changeType: 'modify' as const, diff: '+动态-diff\n-old' }];
    const turnChanges = [...changes, { path: '/dynamic/created.ts', changeType: 'create' as const, diff: '+created' }];
    const view = localeRender(locale, <>
      <FileChangeView changes={changes} artifactId="file-artifact" onArtifactOpen={open} />
      <TurnDiffView changes={turnChanges} artifactId="turn-artifact" onArtifactOpen={open} />
      <FileTreeBlockView tree={[{ name: '动态-tree.ts', type: 'file', path: '/动态/tree.ts' }]} artifactId="tree-artifact" onArtifactOpen={open} />
      <DocumentCard title="动态-document" snippet="byte-snippet" kind="report" onClick={() => open('document-byte')} />
      <CodeReviewBlock className="review-multi" findings={[
        { file: '/动态/review.ts', line: 17, severity: 'error', comment: '动态-comment' },
        { file: '/dynamic/second.ts', line: 23, severity: 'info', comment: 'second-comment-byte' },
        { file: '/dynamic/warning.ts', line: 31, severity: 'warning', comment: 'warning-comment-byte' },
      ]} artifactId="review-artifact" onArtifactOpen={open} />
      <CodeReviewBlock className="review-single" findings={[
        { file: '/dynamic/single.ts', line: 1, severity: 'info', comment: 'single-comment-byte' },
      ]} />
    </>);
    expect(view.container).toHaveTextContent(t('block.file_change.summaryOne'));
    expect(view.container).toHaveTextContent(t('block.file_change.summary', { count: 2 }));
    expect(view.container).toHaveTextContent(t('block.file_tree.title'));
    expect(view.container).toHaveTextContent(t('document.kind.report'));
    expect(view.container).toHaveTextContent(t('review.title'));
    expect(view.container).toHaveTextContent(t('review.findingCount', { count: 3 }));
    expect(view.container).toHaveTextContent(t('review.findingCountOne'));
    expect(view.container).toHaveTextContent(t('review.errorCountOne'));
    expect(view.container).toHaveTextContent(t('review.warningCountOne'));
    expect(view.container).toHaveTextContent('/动态/review.ts:17');
    expect(view.container).toHaveTextContent('动态-comment');
    const findings = Array.from(view.container.querySelectorAll('.review-multi .svton-code-review-finding'));
    expect(findings.map((finding) => finding.textContent)).toEqual([
      expect.stringContaining('/动态/review.ts:17'),
      expect.stringContaining('/dynamic/second.ts:23'),
      expect.stringContaining('/dynamic/warning.ts:31'),
    ]);
    expect(findings[1]).toHaveTextContent('second-comment-byte');
    fireEvent.click(screen.getAllByRole('button', { name: t('action.openContentPanel') })[0]);
    expect(open).toHaveBeenCalledWith({ kind: 'diff', id: 'file-artifact', title: t('block.file_change.panelTitle'), changes });
    fireEvent.click(screen.getByRole('button', { name: /动态-document/ }));
    expect(open).toHaveBeenCalledWith('document-byte');
    fireEvent.click(screen.getByRole('button', { name: /动态\/review\.ts/ }));
    expect(open).toHaveBeenCalledWith({ kind: 'file', id: 'review-artifact:finding:0', path: '/动态/review.ts', line: 17, source: 'review' });
  });
});
