import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ArtifactHostAdapter, ArtifactTarget } from '@svton/agent-ui';
import { useArtifactController } from '../src/artifacts/use-artifact-controller';

const documentTarget = (id: string, content: string): ArtifactTarget => ({
  kind: 'document', id, title: `Doc ${id}`, format: 'markdown', content,
});
const host = (exportGenerated = vi.fn(async () => ({ kind: 'succeeded' as const, message: 'exported' }))): ArtifactHostAdapter => ({
  exportCapability: { supported: true }, exportGenerated,
  resolveOpenCapability: () => ({ supported: true }),
  openReadonly: vi.fn(async () => ({ kind: 'succeeded', message: 'opened' })),
});
async function dispatch(result: { current: ReturnType<typeof useArtifactController> }, intent: Parameters<ReturnType<typeof useArtifactController>['dispatch']>[0]) {
  let outcome!: Awaited<ReturnType<typeof result.current.dispatch>>;
  await act(async () => { outcome = await result.current.dispatch(intent); });
  return outcome;
}

describe('artifact controller', () => {
  it('preserves dirty same-id drafts, confirms replacement, and saves only the session baseline', async () => {
    const { result } = renderHook(() => useArtifactController(host()));
    await dispatch(result, { id: 'open-a', kind: 'artifact.open', target: documentTarget('a', 'source') });
    act(() => result.current.updateDraft('a', 'edited'));
    await dispatch(result, { id: 'rerender-a', kind: 'artifact.open', target: documentTarget('a', 'new source') });
    expect(result.current.state.active).toMatchObject({ draft: 'edited', baseline: 'source', draftState: 'dirty' });

    expect((await dispatch(result, { id: 'open-b', kind: 'artifact.open', target: documentTarget('b', 'next') })).kind).toBe('cancelled');
    expect(result.current.state.confirmation?.kind).toBe('replace');
    await dispatch(result, { id: 'cancel', kind: 'artifact.confirm.cancel' });
    expect(result.current.state.active?.target.id).toBe('a');
    await dispatch(result, { id: 'save', kind: 'artifact.draft.save', targetId: 'a' });
    expect(result.current.state.active).toMatchObject({ baseline: 'edited', draftState: 'saved' });
  });

  it('exports the current draft once and exposes cancelled host outcomes', async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const exportGenerated = vi.fn(async (request) => { await wait; return { kind: 'cancelled' as const, message: request.content }; });
    const { result } = renderHook(() => useArtifactController(host(exportGenerated)));
    await dispatch(result, { id: 'open', kind: 'artifact.open', target: documentTarget('a', 'source') });
    act(() => result.current.updateDraft('a', 'latest'));
    let first!: ReturnType<typeof result.current.dispatch>;
    let duplicate!: ReturnType<typeof result.current.dispatch>;
    act(() => {
      first = result.current.dispatch({ id: 'export', kind: 'artifact.export', targetId: 'a' });
      duplicate = result.current.dispatch({ id: 'duplicate', kind: 'artifact.export', targetId: 'a' });
    });
    await act(async () => expect((await duplicate).kind).toBe('cancelled'));
    await act(async () => { release(); expect((await first).kind).toBe('cancelled'); });
    expect(exportGenerated).toHaveBeenCalledTimes(1);
    expect(exportGenerated.mock.calls[0][0].content).toBe('latest');
  });

  it('restores focus to the original opener after a clean close', async () => {
    vi.useFakeTimers();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { result } = renderHook(() => useArtifactController());
    await dispatch(result, { id: 'open', kind: 'artifact.open', target: documentTarget('a', 'source') });
    await dispatch(result, { id: 'close', kind: 'artifact.close', targetId: 'a' });
    act(() => vi.runAllTimers());
    expect(document.activeElement).toBe(opener);
    opener.remove();
    vi.useRealTimers();
  });

  it('falls back to an editable side panel when external presentation fails', async () => {
    const adapter = host();
    adapter.presentEditable = vi.fn(async () => ({
      kind: 'failed', retryable: true, message: '窗口预览失败，已改在侧栏打开。',
    }));
    const { result } = renderHook(() => useArtifactController(adapter));
    const outcome = await dispatch(result, { id: 'open', kind: 'artifact.open', target: documentTarget('a', 'source') });
    expect(outcome.kind).toBe('failed');
    expect(result.current.state.active?.target.id).toBe('a');
    expect(result.current.state.result?.message).toContain('侧栏');
  });

  it('keeps a dirty same-id panel local instead of presenting stale source externally', async () => {
    const adapter = host();
    adapter.presentEditable = vi.fn(async () => ({ kind: 'succeeded', message: 'popout' }));
    const { result } = renderHook(() => useArtifactController(adapter));
    adapter.presentEditable = undefined;
    await dispatch(result, { id: 'first', kind: 'artifact.open', target: documentTarget('a', 'source') });
    act(() => result.current.updateDraft('a', 'unsaved current draft'));
    const presentEditable = vi.fn(async () => ({ kind: 'succeeded' as const, message: 'popout' }));
    adapter.presentEditable = presentEditable;
    await dispatch(result, { id: 'same-id', kind: 'artifact.open', target: documentTarget('a', 'stale rerender') });
    expect(presentEditable).not.toHaveBeenCalled();
    expect(result.current.state.active).toMatchObject({ draft: 'unsaved current draft', draftState: 'dirty' });
  });

  it('keeps a saved session draft local after close instead of presenting stale source', async () => {
    const adapter = host();
    const { result } = renderHook(() => useArtifactController(adapter));
    await dispatch(result, { id: 'first', kind: 'artifact.open', target: documentTarget('a', 'source') });
    act(() => result.current.updateDraft('a', 'saved session draft'));
    await dispatch(result, { id: 'save', kind: 'artifact.draft.save', targetId: 'a' });
    await dispatch(result, { id: 'close', kind: 'artifact.close', targetId: 'a' });
    const presentEditable = vi.fn(async () => ({ kind: 'succeeded' as const, message: 'popout' }));
    adapter.presentEditable = presentEditable;
    await dispatch(result, { id: 'reopen', kind: 'artifact.open', target: documentTarget('a', 'stale original') });
    expect(presentEditable).not.toHaveBeenCalled();
    expect(result.current.state.active).toMatchObject({ draft: 'saved session draft', draftState: 'saved' });
  });

  it('dismisses a host-only result without creating another persistent notice', async () => {
    const adapter = host();
    adapter.presentEditable = vi.fn(async () => ({ kind: 'succeeded', message: '只读窗口已打开' }));
    const { result } = renderHook(() => useArtifactController(adapter));
    await dispatch(result, { id: 'open', kind: 'artifact.open', target: documentTarget('a', 'source') });
    expect(result.current.state.result?.message).toContain('只读窗口');
    await dispatch(result, { id: 'dismiss', kind: 'artifact.result.dismiss' });
    expect(result.current.state.result).toBeNull();
  });

  it('restores the exact confirmation opener after cancelling a dirty close', async () => {
    vi.useFakeTimers();
    const originalOpener = document.createElement('button');
    const closeButton = document.createElement('button');
    document.body.append(originalOpener, closeButton);
    originalOpener.focus();
    const { result } = renderHook(() => useArtifactController());
    await dispatch(result, { id: 'open', kind: 'artifact.open', target: documentTarget('a', 'source') });
    act(() => result.current.updateDraft('a', 'dirty'));
    closeButton.focus();
    await dispatch(result, { id: 'close', kind: 'artifact.close', targetId: 'a' });
    originalOpener.focus();
    await dispatch(result, { id: 'cancel', kind: 'artifact.confirm.cancel' });
    act(() => vi.runAllTimers());
    expect(document.activeElement).toBe(closeButton);
    originalOpener.remove();
    closeButton.remove();
    vi.useRealTimers();
  });
});
