import { beforeEach, describe, expect, it } from 'vitest';
import 'reflect-metadata';
import {
  AgentRuntime,
  ToolRegistry,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
  type AgentMessage,
  type ToolCall,
  type ToolContext,
  type ToolResult,
} from '@svton/agent-core';
import { ChatService } from '../src/service/chat.service';
import {
  buildPiAgentConfig,
  makeBrowserPlatform,
  type MockModelsHandle,
} from './helpers/pi-test-utils';

interface Harness {
  service: ChatService;
  runtime: AgentRuntime;
  mock: MockModelsHandle;
}

describe('ChatService canonical history rollback', () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService();
  });

  it('retries with one copy of the prompt and removes the old assistant response', async () => {
    const { runtime, mock } = await createHarness(service);
    mock.addResponse(fauxAssistantMessage([fauxText('old response')]));
    await service.sendMessage('retry target');

    mock.addResponse(fauxAssistantMessage([fauxText('new response')]));
    await service.retry();

    const canonical = runtime.getCanonicalMessages();
    expect(userTexts(canonical)).toEqual(['retry target']);
    expect(serialized(canonical)).not.toContain('old response');
    expect(serialized(canonical)).toContain('new response');
    expect(service.messages.map((message) => message.content))
      .toEqual(['retry target', 'new response']);
  });

  it('starts a cleared conversation without canonical history from the prior session', async () => {
    const { runtime, mock } = await createHarness(service);
    mock.addResponse(fauxAssistantMessage([fauxText('old response')]));
    await service.sendMessage('old conversation prompt');

    service.clearMessages();
    expect(runtime.getCanonicalMessages()).toEqual([]);

    mock.addResponse(fauxAssistantMessage([fauxText('fresh response')]));
    await service.sendMessage('fresh conversation prompt');

    const canonical = runtime.getCanonicalMessages();
    expect(userTexts(canonical)).toEqual(['fresh conversation prompt']);
    expect(serialized(canonical)).not.toContain('old conversation prompt');
    expect(serialized(canonical)).not.toContain('old response');
    expect(service.messages.map((message) => message.content))
      .toEqual(['fresh conversation prompt', 'fresh response']);
  });

  it('preserves the exact canonical prefix when retrying from a later user turn', async () => {
    const { runtime, mock } = await createHarness(service);
    mock.addResponse(fauxAssistantMessage([fauxText('first response')]));
    await service.sendMessage('first prompt');
    mock.addResponse(fauxAssistantMessage([fauxText('old second response')]));
    await service.sendMessage('second prompt');
    const before = runtime.getCanonicalMessages();
    const secondUser = service.messages.find(
      (message) => message.role === 'user' && message.content === 'second prompt',
    )!;
    delete secondUser.runtimeMessageIndex;

    mock.addResponse(fauxAssistantMessage([fauxText('new second response')]));
    await service.retryFromMessage(secondUser.id);

    const after = runtime.getCanonicalMessages();
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(userTexts(after)).toEqual(['first prompt', 'second prompt']);
    expect(serialized(after)).not.toContain('old second response');
    expect(serialized(after)).toContain('new second response');
  });

  it('edits a turn without retaining the old prompt or reply', async () => {
    const { runtime, mock } = await createHarness(service);
    mock.addResponse(fauxAssistantMessage([fauxText('old reply')]));
    await service.sendMessage('old prompt');
    const userId = service.messages[0].id;

    mock.addResponse(fauxAssistantMessage([fauxText('edited reply')]));
    await service.editMessage(userId, 'edited prompt');

    const canonical = runtime.getCanonicalMessages();
    expect(userTexts(canonical)).toEqual(['edited prompt']);
    expect(serialized(canonical)).not.toContain('old prompt');
    expect(serialized(canonical)).not.toContain('old reply');
    expect(serialized(canonical)).toContain('edited reply');
  });

  it('removes a complete tool call/result chain when retrying its user turn', async () => {
    const { runtime, mock } = await createHarness(service, true);
    mock.addResponse(fauxAssistantMessage([fauxToolCall('test_tool', { key: 'value' })]));
    mock.addResponse(fauxAssistantMessage([fauxText('old tool reply')]));
    await service.sendMessage('use the tool');
    expect(runtime.getCanonicalMessages().some((message) => message.role === 'toolResult'))
      .toBe(true);

    mock.addResponse(fauxAssistantMessage([fauxText('retry without tool')]));
    await service.retry();

    const canonical = runtime.getCanonicalMessages();
    expect(userTexts(canonical)).toEqual(['use the tool']);
    expect(canonical.some((message) => message.role === 'toolResult')).toBe(false);
    expect(serialized(canonical)).not.toContain('old tool reply');
    expect(serialized(canonical)).not.toContain('toolCall');
  });

  it('keeps UI and canonical history retryable after a provider failure', async () => {
    const { runtime, mock } = await createHarness(service);
    mock.addResponse(fauxAssistantMessage([fauxText('initial reply')]));
    await service.sendMessage('failure target');
    mock.addResponse(async () => { throw new Error('provider failed'); });

    await service.retry();
    expect(service.messages[0].content).toBe('failure target');
    expect(service.messages[1].error).toContain('provider failed');
    expect(userTexts(runtime.getCanonicalMessages())).toEqual(['failure target']);

    mock.addResponse(fauxAssistantMessage([fauxText('recovered reply')]));
    await service.retry();
    expect(userTexts(runtime.getCanonicalMessages())).toEqual(['failure target']);
    expect(serialized(runtime.getCanonicalMessages())).toContain('recovered reply');
    expect(service.messages.map((message) => message.content))
      .toEqual(['failure target', 'recovered reply']);
  });
});

async function createHarness(
  service: ChatService,
  withTool = false,
): Promise<Harness> {
  const registry = new ToolRegistry();
  if (withTool) {
    registry.register({
      name: 'test_tool',
      description: 'Test canonical tool history',
      parameters: {
        type: 'object',
        properties: { key: { type: 'string' } },
      },
    }, {
      execute: async (
        call: ToolCall,
        _context: ToolContext,
      ): Promise<ToolResult> => ({
        callId: call.id,
        output: `result:${String(call.arguments.key)}`,
      }),
    });
  }
  const { config, mock } = buildPiAgentConfig({ toolRegistry: registry });
  await service.init(makeBrowserPlatform(), config);
  const runtime = (service as unknown as { runtime: AgentRuntime }).runtime;
  return { service, runtime, mock };
}

function userTexts(messages: AgentMessage[]): string[] {
  return messages
    .filter((message) => message.role === 'user')
    .map((message) => (
      typeof message.content === 'string'
        ? message.content
        : message.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('')
    ));
}

function serialized(messages: AgentMessage[]): string {
  return JSON.stringify(messages);
}
