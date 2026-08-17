import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ArtifactTarget, ComposerFileAdapter, ComposerIntent } from '@svton/agent-ui';
import { createTranslator, LocaleProvider, type Locale } from '@svton/ui';
import { useArtifactController } from '../src/artifacts/use-artifact-controller';
import { buildComposerSubmission } from '../src/chat/composer-submission';
import { useChatInteractionController } from '../src/chat/use-chat-interaction-controller';

const wrapper = (locale: Locale) => ({ children }: PropsWithChildren) => (
  <LocaleProvider locale={locale}>{children}</LocaleProvider>
);
const documentTarget = (id: string): ArtifactTarget => ({
  kind: 'document', id, title: `Dynamic ${id}`, format: 'markdown', content: `payload ${id}`,
});
async function runComposer(
  locale: Locale,
  options: Parameters<typeof useChatInteractionController>[0],
  intent: ComposerIntent,
) {
  const hook = renderHook(() => useChatInteractionController(options), { wrapper: wrapper(locale) });
  let outcome!: Awaited<ReturnType<typeof hook.result.current.dispatch>>;
  await act(async () => { outcome = await hook.result.current.dispatch(intent); });
  hook.unmount();
  return outcome;
}

describe.each(['en', 'zh'] as const)('%s shared result copy', (locale) => {
  const t = createTranslator(locale);

  it('localizes composer controller branches without changing result semantics', async () => {
    const common = { canSend: true, isStreaming: false, send: async () => true };
    const busy = await runComposer(locale, { ...common, canSend: false }, {
      id: 'busy-id', kind: 'turn.send', draft: { text: 'byte exact', attachments: [] },
    });
    expect(busy).toEqual({ id: 'busy-id', kind: 'busy', retryable: true, message: t('chat.interaction.sendBusy') });
    const failed = await runComposer(locale, { ...common, send: async () => { throw new Error('private'); } }, {
      id: 'failed-id', kind: 'turn.send', draft: { text: 'byte exact', attachments: [] },
    });
    expect(failed).toEqual({ id: 'failed-id', kind: 'failed', retryable: true, message: t('chat.interaction.failed') });
    const stop = await runComposer(locale, common, { id: 'stop-id', kind: 'turn.stop' });
    expect(stop).toEqual({ id: 'stop-id', kind: 'unsupported', message: t('chat.interaction.stopUnsupported') });
    const file = await runComposer(locale, common, { id: 'file-id', kind: 'draft.file.pick' });
    expect(file).toEqual({ id: 'file-id', kind: 'unsupported', message: t('chat.interaction.fileUnsupported') });
    const command = await runComposer(locale, common, {
      id: 'command-id', kind: 'slash.execute', commandId: 'missing', args: 'dynamic args',
    });
    expect(command).toEqual({ id: 'command-id', kind: 'unsupported', message: t('chat.interaction.commandUnsupported') });
    const action = await runComposer(locale, common, {
      id: 'action-id', kind: 'assistantAction.execute', actionId: 'missing', payload: 'dynamic payload',
    });
    expect(action).toEqual({ id: 'action-id', kind: 'unsupported', message: t('command.unavailable') });
  });

  it('localizes file validation while preserving dynamic filenames', async () => {
    const attachment = { id: 'file-id', kind: 'file' as const, name: '动态-dynamic.txt', path: '/same/路径.txt', size: 10 };
    const adapter = (text: string): ComposerFileAdapter => ({
      capability: { supported: true }, pick: async () => ({ kind: 'cancelled' }),
      readText: async () => ({ kind: 'succeeded', text }),
    });
    const binary = await buildComposerSubmission({ text: 'unchanged', attachments: [attachment] }, adapter('a\0b'), t);
    const long = await buildComposerSubmission({ text: 'unchanged', attachments: [attachment] }, adapter('a'.repeat(20_001)), t);
    expect(binary).toEqual({ kind: 'failed', message: t('chat.interaction.fileBinaryKept', { name: attachment.name }) });
    expect(long).toEqual({ kind: 'failed', message: t('chat.interaction.fileTextTooLongKept', { name: attachment.name }) });
    expect(JSON.stringify([binary, long])).toContain(attachment.name);
  });

  it('localizes artifact state results while preserving IDs and target payloads', async () => {
    const hook = renderHook(() => useArtifactController(), { wrapper: wrapper(locale) });
    const dispatch = async (intent: Parameters<typeof hook.result.current.dispatch>[0]) => {
      let outcome!: Awaited<ReturnType<typeof hook.result.current.dispatch>>;
      await act(async () => { outcome = await hook.result.current.dispatch(intent); });
      return outcome;
    };
    const first = documentTarget('动态-a');
    expect(await dispatch({ id: 'open', kind: 'artifact.open', target: first }))
      .toEqual({ id: 'open', kind: 'succeeded', message: t('artifact.result.opened') });
    expect(hook.result.current.state.active?.target).toEqual(first);
    expect(await dispatch({ id: 'same', kind: 'artifact.open', target: first }))
      .toEqual({ id: 'same', kind: 'succeeded', message: t('artifact.result.panelPreserved') });
    act(() => hook.result.current.updateDraft(first.id, 'byte-identical 动态 draft'));
    expect(await dispatch({ id: 'replace', kind: 'artifact.open', target: documentTarget('b') }))
      .toEqual({ id: 'replace', kind: 'cancelled', message: t('artifact.result.unsavedReplace') });
    expect(await dispatch({ id: 'keep', kind: 'artifact.confirm.cancel' }))
      .toEqual({ id: 'keep', kind: 'cancelled', message: t('artifact.result.changesKept') });
    expect(await dispatch({ id: 'close', kind: 'artifact.close', targetId: first.id }))
      .toEqual({ id: 'close', kind: 'cancelled', message: t('artifact.result.unsavedClose') });
    expect(await dispatch({ id: 'discard', kind: 'artifact.confirm.discard' }))
      .toEqual({ id: 'discard', kind: 'succeeded', message: t('artifact.result.discarded') });
    expect(await dispatch({ id: 'closed', kind: 'artifact.close', targetId: first.id }))
      .toEqual({ id: 'closed', kind: 'cancelled', message: t('artifact.result.alreadyClosed') });
    expect(await dispatch({ id: 'none', kind: 'artifact.confirm.discard' }))
      .toEqual({ id: 'none', kind: 'cancelled', message: t('artifact.result.noConfirmation') });
  });
});
