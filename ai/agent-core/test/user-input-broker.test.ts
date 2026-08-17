import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionManager } from '../src/permission/manager';
import { SvtonAgentRuntime } from '../src/agent/svton-agent-runtime';
import { ToolRegistry } from '../src/tool/registry';
import { UserInputBroker } from '../src/agent/user-input-broker';
import {
  readUserInputQuestions,
  validateUserInputAnswers,
} from '../src/agent/user-input-validator';
import { enforceActiveSkillToolGate } from '../src/agent/tool-skill-gate.utils';
import {
  RequestUserInputExecutor,
  requestUserInputDef,
} from '../src/tool/builtins/request-user-input';
import {
  createMockModels,
  createMockPlatform,
  fauxAssistantMessage,
  fauxText,
  fauxToolCall,
} from './helpers';

const textQuestion = {
  id: 'name', header: 'Name', question: 'What is your name?',
  isOther: false, isSecret: false, options: null,
};
const optionQuestion = {
  id: 'color', header: 'Color', question: 'Pick a color', isOther: true, isSecret: false,
  options: [{ label: 'Blue', description: 'Cool color' }],
};

afterEach(() => vi.useRealTimers());

describe('structured user input validation', () => {
  it('accepts one to three text, option, and Other answers', () => {
    const questions = readUserInputQuestions([textQuestion, optionQuestion]);
    expect(validateUserInputAnswers(questions, {
      name: { answers: [' Ada '] }, color: { answers: ['Green'] },
    })).toEqual({ name: { answers: ['Ada'] }, color: { answers: ['Green'] } });
  });

  it('rejects invalid counts, ids, empty values, and unknown options', () => {
    expect(() => readUserInputQuestions([])).toThrow('between 1 and 3');
    expect(() => readUserInputQuestions([textQuestion, textQuestion])).toThrow('unique');
    const strictOption = readUserInputQuestions([{ ...optionQuestion, isOther: false }]);
    expect(() => validateUserInputAnswers(strictOption, { color: { answers: ['Red'] } }))
      .toThrow('allowed option');
    expect(() => validateUserInputAnswers([textQuestion], { wrong: { answers: ['x'] } }))
      .toThrow('match every');
  });
});

describe('UserInputBroker', () => {
  it('keys requests by session, preserves request idempotency, and settles once', async () => {
    const events: unknown[] = [];
    const broker = new UserInputBroker((event) => events.push(event));
    const first = broker.request('s1', 'r1', [textQuestion]);
    const duplicate = broker.request('s1', 'r1', [textQuestion]);
    const otherSession = broker.request('s2', 'r1', [textQuestion]);
    expect(duplicate).toBe(first);
    expect(events).toHaveLength(2);
    expect(broker.respond('s1', 'r1', { name: { answers: ['Ada'] } })).toBe(true);
    expect(broker.respond('s1', 'r1', { name: { answers: ['Ignored'] } })).toBe(false);
    await expect(first).resolves.toEqual({ name: { answers: ['Ada'] } });
    broker.abortPending('s2');
    await expect(otherSession).rejects.toThrow('interrupted');
    const externallyResolved = broker.request('s3', 'external', [textQuestion]);
    expect(broker.interrupt('s3', 'external')).toBe(true);
    await expect(externallyResolved).rejects.toThrow('interrupted');
  });

  it('interrupts on abort and timeout without fabricating answers', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const broker = new UserInputBroker(() => {});
    const aborted = broker.request('s1', 'abort', [textQuestion], undefined, controller.signal);
    controller.abort();
    await expect(aborted).rejects.toThrow('interrupted');
    const timed = broker.request('s1', 'timeout', [textQuestion], 60_000);
    const timedExpectation = expect(timed).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(60_000);
    await timedExpectation;
  });

  it('bounds settled duplicate keys and clears them on reset', async () => {
    const broker = new UserInputBroker(() => {});
    for (let index = 0; index < 520; index += 1) {
      const requestId = `request-${index}`;
      const pending = broker.request('s1', requestId, [textQuestion]);
      expect(broker.respond('s1', requestId, { name: { answers: ['Ada'] } })).toBe(true);
      await pending;
    }
    expect(broker.settledSize).toBe(512);
    broker.reset();
    expect(broker.settledSize).toBe(0);
  });
});

describe('request_user_input tool boundary', () => {
  it('is permission-safe in every mode and suspends until an atomic response', async () => {
    for (const mode of ['read_only', 'plan', 'default'] as const) {
      expect(new PermissionManager({ mode }).check({
        id: 'r1', name: requestUserInputDef.name, arguments: {},
      })).toEqual({ allowed: true, needsApproval: false });
    }
    expect(enforceActiveSkillToolGate({
      id: 'r1', name: 'request_user_input', arguments: {},
    }, [{ name: 'restricted', description: '', allowedTools: ['file_read'] }])).toBeNull();
    const broker = new UserInputBroker(() => {});
    const executor = new RequestUserInputExecutor();
    const resultPromise = executor.execute(
      { id: 'r1', name: 'request_user_input', arguments: { questions: [textQuestion] } },
      {
        platform: {} as never, sessionId: 's1', workingDir: '/',
        requestUserInput: (id, questions, ms) => broker.request('s1', id, questions, ms),
      },
    );
    expect(broker.size).toBe(1);
    broker.respond('s1', 'r1', { name: { answers: ['Ada'] } });
    await expect(resultPromise).resolves.toMatchObject({ callId: 'r1' });
  });

  it('pauses the Pi run, accepts a response, and continues to the final answer', async () => {
    const mock = createMockModels();
    const registry = new ToolRegistry();
    registry.register(requestUserInputDef, new RequestUserInputExecutor());
    const runtime = SvtonAgentRuntime.create({
      models: mock.models, piModel: mock.model, model: 'test-model', toolRegistry: registry,
    }, createMockPlatform());
    const secretQuestion = { ...textQuestion, id: 'secret', isSecret: true };
    mock.addResponse(fauxAssistantMessage([
      fauxToolCall('request_user_input', { questions: [secretQuestion] }),
    ]));
    mock.addResponse(fauxAssistantMessage([fauxText('Thanks, continuing now.') ]));

    const events = [];
    for await (const event of runtime.run('Ask me first', { sessionId: 'session-1' })) {
      events.push(event);
      if (event.type === 'user_input_requested') {
        expect(event.request.sessionId).toBe('session-1');
        runtime.respondToUserInput('session-1', event.request.requestId, {
          secret: { answers: ['runtime-secret'] },
        });
      }
    }
    expect(events.some((event) => event.type === 'user_input_requested')).toBe(true);
    expect(events.some((event) => event.type === 'user_input_settled')).toBe(true);
    expect(JSON.stringify(runtime.getMessages())).not.toContain('runtime-secret');
    expect(JSON.stringify(runtime.getMessages())).toContain('Thanks, continuing now.');
  });
});
