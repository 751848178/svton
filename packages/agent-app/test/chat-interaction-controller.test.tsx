import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComposerFileAdapter, ComposerSubmission, SlashCommand } from '@svton/agent-ui';
import { createTranslator } from '@svton/ui';
import { useChatInteractionController } from '../src/chat/use-chat-interaction-controller';
import {
  buildComposerSubmission,
  formatRuntimeComposerSubmission,
  prepareChatInput,
} from '../src/chat/composer-submission';

const emptySubmission = (text = 'hello'): ComposerSubmission => ({
  text, inputs: [],
});

async function withinAct<T>(run: () => Promise<T>): Promise<T> {
  let value!: T;
  await act(async () => { value = await run(); });
  return value;
}

describe('composer interaction controller', () => {
  it('rejects a busy turn without invoking send', async () => {
    const send = vi.fn(async () => true);
    const { result } = renderHook(() => useChatInteractionController({ canSend: false, isStreaming: true, send }));
    let outcome: Awaited<ReturnType<typeof result.current.dispatch>>;
    await act(async () => { outcome = await result.current.dispatch({ id: 'op', kind: 'turn.send', draft: { text: 'draft', attachments: [] } }); });
    expect(outcome!.kind).toBe('busy');
    expect(send).not.toHaveBeenCalled();
  });

  it('guards same-tick duplicate slash execution', async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const execute = vi.fn(async () => { await wait; return true; });
    const commands: SlashCommand[] = [{ id: 'help', name: 'help', description: 'help', execute }];
    const { result } = renderHook(() => useChatInteractionController({ canSend: true, isStreaming: false, send: async () => true, slashCommands: commands }));
    let first!: ReturnType<typeof result.current.dispatch>;
    let second!: ReturnType<typeof result.current.dispatch>;
    act(() => {
      first = result.current.dispatch({ id: 'one', kind: 'slash.execute', commandId: 'help', args: '' });
      second = result.current.dispatch({ id: 'two', kind: 'slash.execute', commandId: 'help', args: '' });
    });
    await act(async () => { expect((await second).kind).toBe('busy'); });
    await act(async () => { release(); await first; });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('executes a legacy name/action command exactly once through the shared controller', async () => {
    const action = vi.fn();
    const commands: SlashCommand[] = [{ name: 'legacy', description: 'legacy', action }];
    const { result } = renderHook(() => useChatInteractionController({
      canSend: true, isStreaming: false, send: async () => true, slashCommands: commands,
    }));
    const outcome = await withinAct(() => result.current.dispatch({
      id: 'legacy-op', kind: 'slash.execute', commandId: 'legacy', args: '',
    }));
    expect(outcome.kind).toBe('succeeded');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('reports unknown slash and assistant actions as unsupported', async () => {
    const { result } = renderHook(() => useChatInteractionController({ canSend: true, isStreaming: false, send: async () => true }));
    expect((await withinAct(() => result.current.dispatch({ id: 's', kind: 'slash.execute', commandId: 'missing', args: '' }))).kind).toBe('unsupported');
    expect((await withinAct(() => result.current.dispatch({ id: 'a', kind: 'assistantAction.execute', actionId: 'missing' }))).kind).toBe('unsupported');
    expect(result.current.resolveAssistantAction('missing')).toEqual(expect.objectContaining({ supported: false }));
  });

  it('centrally rejects oversized picker metadata before adding a draft attachment', async () => {
    const adapter: ComposerFileAdapter = {
      capability: { supported: true },
      pick: async () => ({ kind: 'selected', attachment: { id: 'f', kind: 'file', name: 'large.txt', path: '/large.txt', size: 65 * 1024 } }),
      readText: vi.fn(),
    };
    const { result } = renderHook(() => useChatInteractionController({ canSend: true, isStreaming: false, send: async () => true, fileAdapter: adapter }));
    const outcome = await withinAct(() => result.current.dispatch({ id: 'pick', kind: 'draft.file.pick' }));
    expect(outcome.kind).toBe('failed');
    expect(adapter.readText).not.toHaveBeenCalled();
  });

  it('projects host file capability differences explicitly', async () => {
    const unsupported = renderHook(() => useChatInteractionController({ canSend: true, isStreaming: false, send: async () => true }));
    expect((await withinAct(() => unsupported.result.current.dispatch({ id: 'webview', kind: 'draft.file.pick' }))).kind).toBe('unsupported');
    unsupported.unmount();
    const adapter: ComposerFileAdapter = {
      capability: { supported: true },
      pick: async () => ({ kind: 'cancelled' }),
      readText: async () => ({ kind: 'succeeded', text: '' }),
    };
    const supported = renderHook(() => useChatInteractionController({ canSend: true, isStreaming: false, send: async () => true, fileAdapter: adapter }));
    expect((await withinAct(() => supported.result.current.dispatch({ id: 'host', kind: 'draft.file.pick' }))).kind).toBe('cancelled');
  });
});

describe('composer submission boundary', () => {
  it('keeps public text and structured attachment metadata separate from runtime file content', async () => {
    const adapter: ComposerFileAdapter = {
      capability: { supported: true }, pick: async () => ({ kind: 'cancelled' }),
      readText: async () => ({ kind: 'succeeded', text: 'const fence = "```";' }),
    };
    const built = await buildComposerSubmission({
      text: 'review this',
      attachments: [
        { id: 'file-a', kind: 'file', name: 'same.ts', path: '/a/same.ts', size: 20 },
        { id: 'skill', kind: 'skill', name: 'review', path: '/skills/review' },
        { id: 'file-b', kind: 'file', name: 'same.ts', path: '/b/same.ts', size: 20 },
        { id: 'mention', kind: 'mention', name: 'read_file', path: 'tool:read_file', mentionType: 'tool' },
      ],
    }, adapter, createTranslator('en'));
    expect(built.kind).toBe('succeeded');
    if (built.kind !== 'succeeded') return;
    const prepared = prepareChatInput(built.submission);
    expect(prepared.publicContent).toBe('review this');
    expect(prepared.historyContent).toBe('review this');
    expect(prepared.publicAttachments?.map((item) => item.path)).toEqual(['/a/same.ts', '/skills/review', '/b/same.ts', 'tool:read_file']);
    expect(prepared.runtimeContent).toContain('const fence');
    expect(prepared.publicContent).not.toContain('const fence');
    const runtime = JSON.parse(formatRuntimeComposerSubmission(built.submission));
    expect(runtime.schema).toBe('svton.composer-input.v1');
    expect(runtime.inputs.map((item: { kind: string }) => item.kind)).toEqual(['file', 'skill', 'file', 'mention']);
  });

  it('keeps a Web file source opaque instead of inventing a path', () => {
    const prepared = prepareChatInput({
      text: 'web file',
      inputs: [{ kind: 'file', attachment: { id: 'web-file:1', kind: 'file', name: 'same.ts', size: 4 }, text: 'code' }],
    });
    expect(prepared.publicAttachments?.[0]).toMatchObject({ id: 'web-file:1', name: 'same.ts' });
    expect(prepared.publicAttachments?.[0]).not.toHaveProperty('path');
    expect(JSON.parse(prepared.runtimeContent).inputs[0]).not.toHaveProperty('path');
  });

  it('keeps ordinary plain text byte-for-byte compatible', () => {
    expect(prepareChatInput(emptySubmission('plain text')).runtimeContent).toBe('plain text');
  });

  it('distinguishes binary, text-size, and read failures', async () => {
    const file = { id: 'f', kind: 'file' as const, name: 'x.txt', path: '/x.txt', size: 10 };
    const adapter = (result: Awaited<ReturnType<ComposerFileAdapter['readText']>>): ComposerFileAdapter => ({
      capability: { supported: true }, pick: async () => ({ kind: 'cancelled' }), readText: async () => result,
    });
    const t = createTranslator('en');
    expect((await buildComposerSubmission({ text: '', attachments: [file] }, adapter({ kind: 'succeeded', text: 'a\0b' }), t)).kind).toBe('failed');
    expect((await buildComposerSubmission({ text: '', attachments: [file] }, adapter({ kind: 'succeeded', text: 'a'.repeat(20_001) }), t)).kind).toBe('failed');
    expect((await buildComposerSubmission({ text: '', attachments: [file] }, adapter({ kind: 'failed', message: 'read failed' }), t)).kind).toBe('failed');
  });
});
