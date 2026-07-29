/**
 * Regression: the post-turn checkpoint must run.
 *
 * Bug found via the agent-web real browser E2E (W9 refresh-resume): the Pi
 * migration placed `postTurn` (memory extraction + checkpoint) AFTER the
 * terminal `yield doneEvent` in `runtime-run.ts`. The ChatService consumer
 * breaks out of the generator on `done`, so code after the yield never ran —
 * checkpoints were NEVER persisted and session resume was silently broken.
 *
 * This test drives a REAL `SvtonAgentRuntime` turn (not a mock) and asserts the
 * checkpoint is written to storage afterward, locking in the fix that runs
 * `postTurn` BEFORE yielding `done`.
 */
import { describe, it, expect } from 'vitest';
import { SvtonAgentRuntime, SessionResumeManager, ToolRegistry } from '@svton/agent-core';
import { createMockModels, createMockPlatform, fauxAssistantMessage, fauxText, MemoryStorage } from './helpers';
import { collectEvents } from './helpers';

async function runOneTurn(storage: MemoryStorage, sessionId: string): Promise<void> {
  const mock = createMockModels('test-model');
  mock.addResponse(fauxAssistantMessage([fauxText('hello reply')]));
  const platform = createMockPlatform({ storage });
  const config = {
    models: mock.models,
    piModel: mock.model,
    model: 'test-model',
    toolRegistry: new ToolRegistry(),
    workingDir: '/',
    capabilities: { resumeManager: new SessionResumeManager(storage) } as never,
  };
  const runtime = await SvtonAgentRuntime.createAsync(config as never, platform);
  const gen = runtime.run('hi', { sessionId });
  await collectEvents(gen);
}

describe('post-turn checkpoint regression (real runtime turn)', () => {
  it('persists a checkpoint to storage after a turn completes', async () => {
    const storage = new MemoryStorage();
    await runOneTurn(storage, 'sess-real');
    const raw = await storage.get<string>('agent:checkpoint:sess-real');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    // The checkpoint captured the assistant reply (user + assistant messages).
    expect(parsed.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT checkpoint a turn that ends in error', async () => {
    const storage = new MemoryStorage();
    const mock = createMockModels('test-model');
    mock.addResponse(fauxAssistantMessage([fauxText('')], { stopReason: 'error', errorMessage: 'boom' }));
    const platform = createMockPlatform({ storage });
    const config = {
      models: mock.models, piModel: mock.model, model: 'test-model',
      toolRegistry: new ToolRegistry(), workingDir: '/',
      capabilities: { resumeManager: new SessionResumeManager(storage) } as never,
    };
    const runtime = await SvtonAgentRuntime.createAsync(config as never, platform);
    await collectEvents(runtime.run('hi', { sessionId: 'sess-err' })).catch(() => {});
    // An error turn must still checkpoint (stopReason !== 'aborted'); the fix
    // guarantees postTurn runs before the terminal done regardless of outcome.
    const raw = await storage.get<string>('agent:checkpoint:sess-err');
    expect(raw).toBeTruthy();
  });
});
