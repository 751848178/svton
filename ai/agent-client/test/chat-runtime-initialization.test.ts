import { describe, expect, it, vi } from 'vitest';
import type { AgentConfig, SvtonAgentRuntime } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import { ChatRuntimeInitializationService } from '../src/service/chat-runtime-initialization.service';

describe('ChatRuntimeInitializationService generations', () => {
  it('does not let an initialization superseded during history attach publish or touch runtime', async () => {
    const firstAttach = deferred<void>();
    const secondAttach = deferred<void>();
    const harness = createHarness([firstAttach.promise, secondAttach.promise]);
    const oldInit = harness.service.init(harness.platform, harness.oldConfig, 'old');
    const freshInit = harness.service.init(harness.platform, harness.freshConfig, 'fresh');

    secondAttach.resolve();
    await freshInit;
    firstAttach.resolve();
    await oldInit;

    expect(harness.activeConfig()).toBe(harness.freshConfig);
    expect(harness.ensureCurrent).toHaveBeenCalledTimes(1);
    expect(harness.publishSelected).toHaveBeenCalledTimes(1);
    expect(harness.service.ready).toBe(true);
  });

  it('does not let an initialization superseded during ensureCurrent publish or interrupt', async () => {
    const oldRuntime = deferred<SvtonAgentRuntime>();
    const freshRuntime = {} as SvtonAgentRuntime;
    const harness = createHarness(
      [Promise.resolve(), Promise.resolve()],
      [oldRuntime.promise, Promise.resolve(freshRuntime)],
      {} as SvtonAgentRuntime,
    );
    const oldInit = harness.service.init(harness.platform, harness.oldConfig, 'old');
    await vi.waitFor(() => expect(harness.ensureCurrent).toHaveBeenCalledTimes(1));
    const freshInit = harness.service.init(harness.platform, harness.freshConfig, 'fresh');
    await freshInit;
    const interruptCallsAfterFresh = harness.interruptOwner.mock.calls.length;
    oldRuntime.resolve({} as SvtonAgentRuntime);
    await oldInit;

    expect(harness.activeConfig()).toBe(harness.freshConfig);
    expect(harness.publishSelected).toHaveBeenCalledTimes(1);
    expect(harness.interruptOwner).toHaveBeenCalledTimes(interruptCallsAfterFresh);
    expect(harness.service.ready).toBe(true);
  });
});

function createHarness(
  attachResults: Promise<void>[],
  runtimeResults: Promise<SvtonAgentRuntime>[] = [Promise.resolve({} as SvtonAgentRuntime)],
  existingRuntime?: SvtonAgentRuntime,
) {
  let activeConfig: AgentConfig | null = null;
  const ensureCurrent = vi.fn(() => runtimeResults.shift()!);
  const publishSelected = vi.fn();
  const interruptOwner = vi.fn();
  const bindings = {
    runtimes: {
      configure: vi.fn((_platform, config: AgentConfig) => { activeConfig = config; }),
      slot: vi.fn(() => existingRuntime ? { runtime: existingRuntime } : null),
      ensureCurrent,
    },
    ownership: { isProcessing: vi.fn(() => false) },
    history: { attach: vi.fn(() => attachResults.shift()!) },
    owner: () => 'session-a',
    inputHistory: () => [],
    publishInputHistory: vi.fn(),
    interruptOwner,
    publishSelected,
  };
  return {
    service: new ChatRuntimeInitializationService(bindings as never),
    platform: {} as IPlatform,
    oldConfig: {} as AgentConfig,
    freshConfig: {} as AgentConfig,
    activeConfig: () => activeConfig,
    ensureCurrent,
    publishSelected,
    interruptOwner,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
