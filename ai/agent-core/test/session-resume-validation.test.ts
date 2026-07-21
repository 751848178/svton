import { describe, expect, it, vi } from 'vitest';
import { SessionResumeManager } from '@svton/agent-core';
import { MemoryStorage } from './helpers';

function createRestoreRuntime() {
  return {
    model: 'test-model',
    getMessages: vi.fn(() => []),
    getReasoningEffort: vi.fn(() => undefined),
    setMessages: vi.fn(),
    setReasoningEffort: vi.fn(),
  };
}

describe('SessionResumeManager checkpoint validation', () => {
  it('treats malformed checkpoint payloads as missing state', async () => {
    const storage = new MemoryStorage();
    const manager = new SessionResumeManager(storage);
    await storage.set(
      'agent:checkpoint:malformed',
      JSON.stringify({
        model: 'test-model',
        updatedAt: Date.now(),
      }),
    );

    await expect(manager.loadMeta('malformed')).resolves.toBeNull();

    const runtime = createRestoreRuntime();
    await expect(manager.restore('malformed', runtime as any)).resolves.toBe(false);
    expect(runtime.setMessages).not.toHaveBeenCalled();
  });
});
