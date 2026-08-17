import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ChatService } from '../src/service/chat.service';
import { displayToStoredMessages, storedToDisplayMessages } from '../src/hooks/session-message-conversion.utils';
import {
  buildPiAgentConfig,
  EventScripter,
  makeBrowserPlatform,
  nativeAgentEnd,
  nativeTextDelta,
} from './helpers/pi-test-utils';

describe('prepared composer input boundary', () => {
  it('accepts immediately while retaining separate public and runtime content', async () => {
    const service = new ChatService();
    await service.init(makeBrowserPlatform(), buildPiAgentConfig().config);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const scripted = new EventScripter(service).addStream(async function* () {
      await gate;
      yield nativeTextDelta('done');
      yield nativeAgentEnd();
    });

    const accepted = service.acceptPreparedMessage({
      publicContent: 'review this',
      runtimeContent: '{"schema":"svton.composer-input.v1","files":[{"content":"secret source"}]}',
      historyContent: 'review this',
      publicAttachments: [{ id: 'f', kind: 'file', name: 'a.ts', path: '/a.ts' }],
    });
    expect(accepted).toBe(true);
    expect(service.messages[0]).toMatchObject({
      content: 'review this',
      publicAttachments: [{ id: 'f', kind: 'file', name: 'a.ts', path: '/a.ts' }],
    });
    expect(service.messages[0].content).not.toContain('secret source');
    await vi.waitFor(() => expect(scripted.spy).toHaveBeenCalledWith(
      expect.stringContaining('secret source'),
      expect.objectContaining({ runRevision: 1 }),
    ));

    release();
    await vi.waitFor(() => expect(service.isStreaming).toBe(false));
  });

  it('persists and reloads bounded structured public attachment metadata', () => {
    const original = [{
      id: 'u', role: 'user' as const, content: 'draft', timestamp: 1,
      publicAttachments: [
        { id: 'a', kind: 'file' as const, name: 'same.ts', path: '/a/same.ts' },
        { id: 'b', kind: 'file' as const, name: 'same.ts', path: '/b/same.ts' },
      ],
    }];
    const restored = storedToDisplayMessages(displayToStoredMessages(original));
    expect(restored[0].publicAttachments?.map((item) => item.path)).toEqual(['/a/same.ts', '/b/same.ts']);
  });

  it('drops malformed attachment metadata on reload', () => {
    const restored = storedToDisplayMessages([{
      id: 'u', role: 'user', content: 'safe', timestamp: 1,
      publicAttachments: [{ id: 'bad', kind: 'file', name: 'x', path: 'x'.repeat(5_000) }],
    }]);
    expect(restored[0].publicAttachments).toBeUndefined();
  });

  it('allows only file attachments to omit path metadata', () => {
    const restored = storedToDisplayMessages([{
      id: 'u', role: 'user', content: 'safe', timestamp: 1,
      publicAttachments: [
        { id: 'file', kind: 'file', name: 'local.txt' },
        { id: 'skill', kind: 'skill', name: 'review' },
        { id: 'mention', kind: 'mention', name: 'read', mentionType: 'tool' },
      ],
    }]);
    expect(restored[0].publicAttachments).toEqual([{ id: 'file', kind: 'file', name: 'local.txt' }]);
  });
});
