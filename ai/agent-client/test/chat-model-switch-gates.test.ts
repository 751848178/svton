import { describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type {
  ModelSwitchHost,
  ModelSwitchRequest,
} from '../src/index';
import { ChatModelSwitchService } from '../src/service/chat-model-switch.service';
import type { ChatRuntimeRegistryService } from '../src/service/chat-runtime-registry.service';
import type { PreparedRuntimeSwitch } from '../src/service/chat-runtime-registry.types';

type Gate = 'processing' | 'streaming' | 'approval' | 'userInput';

const gateCases: Array<[Gate, string]> = [
  ['processing', '仍在运行'],
  ['streaming', '仍在运行'],
  ['approval', '等待工具审批'],
  ['userInput', '等待问题回答'],
];
const from = { providerId: 'provider-a', modelId: 'model-a' };
const to = { providerId: 'provider-b', modelId: 'model-b' };
const targetSession = 'session-target';

describe('ChatModelSwitchService gates', () => {
  it.each(gateCases)('blocks %s before candidate preparation', async (gate, message) => {
    const harness = makeHarness(gate, 'initial');
    const result = await harness.service.execute(request(), harness.host, vi.fn());

    expect(result).toMatchObject({ kind: 'failed', code: 'blocked' });
    expect(result.kind === 'failed' ? result.message : '').toContain(message);
    expect(harness.prepareConfig).not.toHaveBeenCalled();
    expect(harness.runtimeMocks.prepareSwitch).not.toHaveBeenCalled();
    expect(harness.runtimeMocks.commitSwitch).not.toHaveBeenCalled();
    expect(harness.gateMocks[gate]).toHaveBeenCalledWith(targetSession);
    expect(harness.runtimeMocks.slot).toHaveBeenCalledWith(targetSession);
  });

  it.each(gateCases)('blocks %s that appears before commit', async (gate, message) => {
    const harness = makeHarness(gate, 'commit');
    const result = await harness.service.execute(request(), harness.host, vi.fn());

    expect(result).toMatchObject({ kind: 'failed', code: 'blocked' });
    expect(result.kind === 'failed' ? result.message : '').toContain(message);
    expect(harness.prepareConfig).toHaveBeenCalledOnce();
    expect(harness.runtimeMocks.prepareSwitch).toHaveBeenCalledOnce();
    expect(harness.runtimeMocks.commitSwitch).not.toHaveBeenCalled();
    expect(harness.runtimeMocks.disposeSwitch).toHaveBeenCalledWith(harness.candidate);
    expect(harness.gateMocks[gate]).toHaveBeenLastCalledWith(targetSession);
  });
});

function makeHarness(gate: Gate, timing: 'initial' | 'commit') {
  let blocked = timing === 'initial';
  const candidate = { disposed: false } as PreparedRuntimeSwitch;
  const runtimeMocks = {
    slot: vi.fn(() => ({ modelKey: from })),
    prepareSwitch: vi.fn(async () => candidate),
    commitSwitch: vi.fn(() => true),
    disposeSwitch: vi.fn(),
    commitCreationDefault: vi.fn(),
  };
  const gateMocks = {
    processing: vi.fn(() => gate === 'processing' && blocked),
    streaming: vi.fn(() => gate === 'streaming' && blocked),
    approval: vi.fn(() => gate === 'approval' && blocked),
    userInput: vi.fn(() => gate === 'userInput' && blocked),
  };
  const service = new ChatModelSwitchService({
    runtimes: runtimeMocks as unknown as ChatRuntimeRegistryService,
    activeSession: () => 'session-peer',
    isProcessing: gateMocks.processing,
    isStreaming: gateMocks.streaming,
    hasApproval: gateMocks.approval,
    hasUserInput: gateMocks.userInput,
    isSettingsMutationPending: () => false,
    publishSelected: vi.fn(),
  });
  const prepareConfig = vi.fn(async () => {
    if (timing === 'commit') blocked = true;
    return {
      config: { model: to.modelId } as AgentConfig,
      platform: {} as IPlatform,
      runtimeKey: 'provider-b',
    };
  });
  const host = {
    prepareConfig,
    persistDefault: vi.fn(async () => {}),
    getPersisted: () => from,
  } satisfies ModelSwitchHost;
  return { service, host, prepareConfig, runtimeMocks, gateMocks, candidate };
}

function request(): ModelSwitchRequest {
  return {
    requestId: 'switch-target', sessionId: targetSession,
    from, to, persistence: 'default-and-session',
  };
}
