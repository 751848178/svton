import { describe, expect, it } from 'vitest';
import { AgentRuntime } from '../src/agent/runtime';
import { ToolRegistry } from '../src/tool/registry';
import type {
  ChatMessage,
  ChatOptions,
  IProvider,
  ModelInfo,
  StreamEvent,
} from '../src/provider/types';
import { collectEvents, createMockPlatform } from './helpers';

class ThrowingProvider implements IProvider {
  readonly name = 'throwing';
  readonly models: ModelInfo[] = [{
    id: 'throwing-model',
    name: 'Throwing',
    contextWindow: 128000,
    supportsToolUse: true,
    supportsVision: false,
    supportsStreaming: true,
  }];

  async *chat(
    _messages: ChatMessage[],
    _options: ChatOptions,
  ): AsyncGenerator<StreamEvent> {
    throw { code: 'provider_unavailable' };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  supportsToolUse(): boolean {
    return true;
  }

  supportsVision(): boolean {
    return false;
  }
}

describe('AgentRuntime error formatting', () => {
  it('normalizes non-Error provider stream failures', async () => {
    const runtime = AgentRuntime.create(
      {
        provider: new ThrowingProvider(),
        model: 'throwing-model',
        toolRegistry: new ToolRegistry(),
      },
      createMockPlatform(),
    );

    const events = await collectEvents(runtime.run('hello'));
    const errorEvent = events.find((event) => event.type === 'error');

    expect(errorEvent?.type).toBe('error');
    if (errorEvent?.type === 'error') {
      expect(errorEvent.error).toBeInstanceOf(Error);
      expect(errorEvent.error.message).toBe('Unknown error');
      expect(errorEvent.error.message).not.toContain('[object Object]');
    }
    expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'error' });
  });
});
