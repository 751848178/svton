/**
 * PI007 test utilities for the agent-client suite.
 *
 * These helpers let ChatService/hook tests drive a Pi-backed
 * `SvtonAgentRuntime` without a network.
 *
 * Two layers:
 *  - {@link buildPiAgentConfig} — assembles a valid `AgentConfig` from a
 *    fauxProvider-backed `Models` collection (re-exported from agent-core's
 *    shared test helpers). Feed it to `ChatService.init`.
 *  - {@link EventScripter} — spies on `runtime.run` so tests can queue native
 *    Pi lifecycle and Svton capability events.
 */

import { vi } from 'vitest';
import {
  ToolRegistry,
  type AgentConfig,
  type IRuntime,
  type PublicRuntimeEvent,
} from '@svton/agent-core';
import type { IPlatform, IStorage } from '@svton/agent-platform';
import {
  createMockModels,
  createMockPlatform,
  fauxAssistantMessage,
  fauxThinking,
  fauxToolCall,
  fauxText,
  MemoryStorage,
  nativeAssistantLifecycle,
  nativeAgentEnd,
  nativeError,
  nativeTextDelta,
  nativeThinkingDelta,
  nativeToolEnd,
  nativeToolStart,
  nativeToolUpdate,
  nativeTurnBoundary,
  type MockModelsHandle,
} from '../../../agent-core/test/helpers';

export {
  createMockModels,
  createMockPlatform,
  fauxAssistantMessage,
  fauxThinking,
  fauxToolCall,
  fauxText,
  MemoryStorage,
  nativeAssistantLifecycle,
  nativeAgentEnd,
  nativeError,
  nativeTextDelta,
  nativeThinkingDelta,
  nativeToolEnd,
  nativeToolStart,
  nativeToolUpdate,
  nativeTurnBoundary,
};
export type { MockModelsHandle };
type EventStreamFactory = () => AsyncGenerator<PublicRuntimeEvent>;

/**
 * Build a Pi-backed `AgentConfig` identical in shape to what
 * `createAgentConfig` (agent-app) produces, but with a fauxProvider so no
 * network is touched. Tool registry and capabilities are optional overrides.
 */
export function buildPiAgentConfig(opts: {
  model?: string;
  toolRegistry?: ToolRegistry;
  capabilities?: AgentConfig['capabilities'];
  contextConfig?: AgentConfig['contextConfig'];
  workingDir?: string;
} = {}): { config: AgentConfig; mock: MockModelsHandle } {
  const modelId = opts.model ?? 'test-model';
  const mock = createMockModels(modelId);
  const config: AgentConfig = {
    models: mock.models,
    piModel: mock.model,
    model: modelId,
    toolRegistry: opts.toolRegistry ?? new ToolRegistry(),
    workingDir: opts.workingDir ?? '/',
    ...(opts.capabilities ? { capabilities: opts.capabilities } : {}),
    ...(opts.contextConfig ? { contextConfig: opts.contextConfig } : {}),
  };
  return { config, mock };
}

/**
 * Spy-based event scripter. Replace `runtime.run` with a generator that pops
 * queued `PublicRuntimeEvent[]` scripts in order. Each call consumes one
 * response; if none remain it yields a native `agent_end`.
 *
 * Usage:
 *   const scripter = new EventScripter(service);
 *   scripter.addResponse([nativeTextDelta('Hi'), nativeAgentEnd()]);
 *   await service.sendMessage('Hello');
 */
export class EventScripter {
  private queue: Array<PublicRuntimeEvent[] | EventStreamFactory> = [];
  readonly spy: ReturnType<typeof vi.spyOn>;

  constructor(service: object) {
    const runtime = Reflect.get(service, 'runtime');
    if (!isRuntimeOwner(runtime)) {
      throw new Error('EventScripter requires a ChatService runtime.');
    }
    this.spy = vi.spyOn(runtime, 'run').mockImplementation(() => this.generator());
  }

  addResponse(events: PublicRuntimeEvent[]): this {
    this.queue.push(events);
    return this;
  }

  addStream(factory: EventStreamFactory): this {
    this.queue.push(factory);
    return this;
  }

  setResponses(events: PublicRuntimeEvent[][]): void {
    this.queue = [...events];
  }

  restore(): void {
    this.spy.mockRestore();
  }

  private async *generator(): AsyncGenerator<PublicRuntimeEvent> {
    const response = this.queue.shift() ?? nativeAssistantLifecycle();
    if (typeof response === 'function') {
      yield* response();
      return;
    }
    for (const event of response) {
      yield event;
    }
  }
}

function isRuntimeOwner(value: unknown): value is Pick<IRuntime, 'run'> {
  return typeof value === 'object'
    && value !== null
    && typeof Reflect.get(value, 'run') === 'function';
}

/** Build a browser-style IPlatform backed by MemoryStorage for agent-client tests. */
export function makeBrowserPlatform(storage?: IStorage): IPlatform {
  return createMockPlatform({
    storage: storage ?? new MemoryStorage(),
    type: 'browser',
    capabilities: {
      filesystem: false,
      process: false,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
      sandboxing: false,
      pty: false,
      documentPreview: false,
      computerUse: false,
    },
  });
}
