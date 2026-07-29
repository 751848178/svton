import { describe, expect, it } from 'vitest';
import { SvtonAgentRuntime } from '../src/agent/svton-agent-runtime';
import { ToolRegistry } from '../src/tool/registry';
import { collectEvents, createMockModels, createMockPlatform, fauxAssistantMessage } from './helpers';

describe('SvtonAgentRuntime error formatting (Pi-backed)', () => {
  it('surfaces provider error events as an `error` AgentEvent with done(error)', async () => {
    // PI003: Pi's StreamFn contract encodes failures in the stream via a final
    // AssistantMessage with stopReason "error" + errorMessage (it must not
    // throw). We script the faux provider to return such a message.
    const mock = createMockModels();
    mock.addResponse(
      fauxAssistantMessage('Unknown error', { stopReason: 'error', errorMessage: 'Unknown error' }),
    );

    const runtime = SvtonAgentRuntime.create(
      {
        models: mock.models,
        piModel: mock.model,
        model: 'test-model',
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
