import { describe, expect, it } from 'vitest';
import { PermissionManager } from '../src/permission/manager';
import { SessionResumeManager } from '../src/checkpoint/manager';
import { SvtonAgentRuntime } from '../src/agent/svton-agent-runtime';
import { ToolRegistry } from '../src/tool/registry';
import type { IToolExecutor, ToolCall } from '../src/tool/types';
import {
  MemoryStorage,
  collectEvents,
  createMockModels,
  createMockPlatform,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
} from './helpers';

function registerTool(registry: ToolRegistry, name = 'test_tool'): void {
  const executor: IToolExecutor = {
    execute: async (call: ToolCall) => ({ callId: call.id, output: 'ok' }),
  };
  registry.register({
    name,
    description: name,
    parameters: { type: 'object', properties: {} },
  }, executor);
}

function createRuntime(
  registry: ToolRegistry,
  streamOptions?: { tokenSize?: { min?: number; max?: number }; tokensPerSecond?: number },
): { runtime: SvtonAgentRuntime; mock: ReturnType<typeof createMockModels> } {
  const mock = createMockModels('test-model', streamOptions);
  const runtime = SvtonAgentRuntime.create({
    models: mock.models,
    piModel: mock.model,
    model: 'test-model',
    toolRegistry: registry,
  }, createMockPlatform());
  return { runtime, mock };
}

class BlockingResumeManager extends SessionResumeManager {
  private releaseCheckpoint: (() => void) | null = null;
  private markStarted: () => void = () => {};
  readonly started = new Promise<void>((resolve) => {
    this.markStarted = resolve;
  });

  override async checkpoint(sessionId: string, runtime: SvtonAgentRuntime): Promise<void> {
    this.markStarted();
    await new Promise<void>((resolve) => {
      this.releaseCheckpoint = resolve;
    });
    await super.checkpoint(sessionId, runtime);
  }

  release(): void {
    this.releaseCheckpoint?.();
  }
}

describe('runtime cancellation and settlement', () => {
  it('rejects an overlapping run without replacing or awaiting the active run', async () => {
    const registry = new ToolRegistry();
    registerTool(registry);
    const { runtime, mock } = createRuntime(registry, {
      tokenSize: { min: 1, max: 1 },
      tokensPerSecond: 10,
    });
    runtime.setPermissionManager(new PermissionManager({ mode: 'default' }));
    mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', {})]));
    mock.addResponse(fauxAssistantMessage([fauxText('active complete')]));

    const active = runtime.run('first');
    const started = await active.next();
    expect(started.value?.type).toBe('agent_start');

    const overlap = runtime.run('second');
    await expect(overlap.next()).rejects.toThrow('Svton runtime is already processing');

    let approvalCallId = '';
    while (!approvalCallId) {
      const step = await active.next();
      if (step.done) {
        throw new Error(`Active run ended before approval: ${JSON.stringify(runtime.getMessages().at(-1))}`);
      }
      if (step.value?.type === 'tool_approval_needed') {
        approvalCallId = step.value.request.itemId;
      }
    }
    runtime.approveToolCall(approvalCallId);

    const remaining = await collectEvents(active);
    expect(remaining.at(-1)?.type).toBe('agent_end');
  });

  it('cancels and settles the exact run when a consumer returns during provider streaming', async () => {
    const registry = new ToolRegistry();
    registerTool(registry);
    const { runtime, mock } = createRuntime(registry, {
      tokenSize: { min: 1, max: 1 },
      tokensPerSecond: 10,
    });
    mock.addResponse(fauxAssistantMessage([fauxText('streaming response')]));
    mock.addResponse(fauxAssistantMessage([fauxText('next run')]));

    const stream = runtime.run('first');
    while (true) {
      const step = await stream.next();
      expect(step.done).toBe(false);
      if (
        step.value?.type === 'message_update'
        && step.value.assistantMessageEvent.type === 'text_start'
      ) break;
    }
    await stream.return(undefined);

    const nextRun = await collectEvents(runtime.run('second'));
    expect(nextRun.at(-1)?.type).toBe('agent_end');
  });

  it('tears down an approval wait before allowing the runtime to run again', async () => {
    const registry = new ToolRegistry();
    registerTool(registry);
    const { runtime, mock } = createRuntime(registry);
    runtime.setPermissionManager(new PermissionManager({ mode: 'default' }));
    mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', {})]));
    mock.addResponse(fauxAssistantMessage([fauxText('next run')]));

    const stream = runtime.run('first');
    while (true) {
      const step = await stream.next();
      expect(step.done).toBe(false);
      if (step.value?.type === 'tool_approval_needed') break;
    }
    await stream.return(undefined);

    const nextRun = await collectEvents(runtime.run('second'));
    expect(nextRun.at(-1)?.type).toBe('agent_end');
  });

  it('does not complete the generator before awaited checkpoint settlement', async () => {
    const storage = new MemoryStorage();
    const resumeManager = new BlockingResumeManager(storage);
    const registry = new ToolRegistry();
    registerTool(registry);
    const mock = createMockModels();
    mock.addResponse(fauxAssistantMessage([fauxText('complete')]));
    const runtime = SvtonAgentRuntime.create({
      models: mock.models,
      piModel: mock.model,
      model: 'test-model',
      toolRegistry: registry,
      capabilities: { resumeManager },
    }, createMockPlatform({ storage }));

    let settled = false;
    const completion = collectEvents(runtime.run('go', { sessionId: 'blocked' }))
      .then(() => { settled = true; });
    await resumeManager.started;
    expect(settled).toBe(false);
    resumeManager.release();
    await completion;
    expect(settled).toBe(true);
  });
});
