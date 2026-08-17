import { describe, expect, it, vi } from 'vitest';
import { createTimelineHostIntentHandler } from '../src/components/timeline-host-intents';

describe('timeline host intents', () => {
  it('routes typed copy and retry only to real handlers', async () => {
    const copy = vi.fn();
    const retry = vi.fn();
    const handler = createTimelineHostIntentHandler({ copy, retry });
    await expect(handler({ type: 'copy', target: 'stdout', value: 'ok' }))
      .resolves.toEqual({ status: 'handled' });
    await expect(handler({ type: 'retry', descriptor: { kind: 'message', messageId: 'm1' } }))
      .resolves.toEqual({ status: 'handled' });
    expect(copy).toHaveBeenCalledWith({ type: 'copy', target: 'stdout', value: 'ok' });
    expect(retry).toHaveBeenCalledWith({
      type: 'retry', descriptor: { kind: 'message', messageId: 'm1' },
    });
  });

  it('reports openTerminal unavailable instead of pretending success', async () => {
    const handler = createTimelineHostIntentHandler({});
    await expect(handler({ type: 'openTerminal', terminalReference: 'terminal-1' }))
      .resolves.toEqual({ status: 'unavailable' });
    await expect(handler({ type: 'open', target: 'path', value: '/exact/path' }))
      .resolves.toEqual({ status: 'unavailable' });
  });

  it('propagates an explicit unavailable result from a host action', async () => {
    const handler = createTimelineHostIntentHandler({
      open: () => ({ status: 'unavailable', message: 'Diff unavailable' }),
    });
    await expect(handler({ type: 'open', target: 'diff', value: '@@ diff' }))
      .resolves.toEqual({ status: 'unavailable', message: 'Diff unavailable' });
  });

  it('keeps file copy and open targets typed across hosts', async () => {
    const copy = vi.fn();
    const open = vi.fn();
    const handler = createTimelineHostIntentHandler({ copy, open });
    await expect(handler({ type: 'copy', target: 'path', value: '/workspace/app.ts' }))
      .resolves.toEqual({ status: 'handled' });
    await expect(handler({ type: 'copy', target: 'diff', value: '@@ diff' }))
      .resolves.toEqual({ status: 'handled' });
    await expect(handler({ type: 'open', target: 'path', value: '/workspace/app.ts' }))
      .resolves.toEqual({ status: 'handled' });
    expect(copy).toHaveBeenNthCalledWith(1, {
      type: 'copy', target: 'path', value: '/workspace/app.ts',
    });
    expect(copy).toHaveBeenNthCalledWith(2, {
      type: 'copy', target: 'diff', value: '@@ diff',
    });
    expect(open).toHaveBeenCalledWith({
      type: 'open', target: 'path', value: '/workspace/app.ts',
    });
  });
});
