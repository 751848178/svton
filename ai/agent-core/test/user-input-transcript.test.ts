import { describe, expect, it } from 'vitest';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { redactUserInputToolResults } from '../src/agent/user-input-transcript.utils';

const output = (answers: Record<string, { answers: string[] }>) =>
  JSON.stringify({ answers });

function resultMessage(
  text: string,
  metadata?: Record<string, unknown>,
): AgentMessage {
  return {
    role: 'toolResult',
    toolCallId: 'request-1',
    toolName: 'request_user_input',
    content: [{ type: 'text', text }],
    ...(metadata ? { details: { metadata } } : {}),
    isError: false,
    timestamp: 1,
  };
}

describe('request_user_input canonical transcript redaction', () => {
  it('preserves nonsecret structured answers', () => {
    const text = output({ public: { answers: ['Blue'] } });
    const [message] = redactUserInputToolResults([resultMessage(text, {
      structuredUserInput: true,
      containsSecret: false,
      secretQuestionIds: [],
    })]);

    expect(message.content).toEqual([{ type: 'text', text }]);
  });

  it('removes secret answers using secret question ids', () => {
    const [message] = redactUserInputToolResults([resultMessage(
      output({ token: { answers: ['do-not-persist'] } }),
      { containsSecret: true, secretQuestionIds: ['token'] },
    )]);

    expect(JSON.stringify(message)).not.toContain('do-not-persist');
    expect(JSON.stringify(message)).toContain('[redacted]');
  });

  it('preserves public answers while redacting mixed secret answers', () => {
    const [message] = redactUserInputToolResults([resultMessage(output({
      token: { answers: ['do-not-persist'] },
      color: { answers: ['Blue'] },
    }), { containsSecret: true, secretQuestionIds: ['token'] })]);
    const serialized = JSON.stringify(message);

    expect(serialized).not.toContain('do-not-persist');
    expect(serialized).toContain('Blue');
    expect(serialized).toContain('[redacted]');
  });

  it('fails closed for malformed or legacy secret results', () => {
    const secret = 'malformed-secret';
    const malformed = redactUserInputToolResults([resultMessage(
      secret,
      { containsSecret: true, secretQuestionIds: ['token'] },
    )]);
    const legacy = redactUserInputToolResults([resultMessage(secret)]);

    expect(JSON.stringify(malformed)).not.toContain(secret);
    expect(JSON.stringify(legacy)).not.toContain(secret);
    expect(JSON.stringify(malformed)).toContain('Structured user input submitted');
  });
});
