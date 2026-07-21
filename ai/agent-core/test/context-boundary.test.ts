import { describe, expect, it } from 'vitest';
import { ContextManager } from '../src/agent/context';
import type { ChatMessage, ContentBlock } from '../src/provider/types';

function firstToolUseInput(message: ChatMessage): Record<string, unknown> {
  const content = message.content as ContentBlock[];
  return (content[0] as Extract<ContentBlock, { type: 'tool_use' }>).input;
}

describe('ContextManager message ownership boundaries', () => {
  it('stores incoming message copies so caller-owned objects cannot mutate history', () => {
    const cm = new ContextManager();
    const message: ChatMessage = {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'call_1', name: 'bash', input: { command: 'pwd' } },
      ],
    };

    cm.addMessage(message);
    message.role = 'user';
    firstToolUseInput(message).command = 'rm -rf .';

    const stored = cm.getMessages()[0];
    expect(stored.role).toBe('assistant');
    expect(firstToolUseInput(stored).command).toBe('pwd');
  });

  it('returns message copies so getMessages callers cannot mutate history', () => {
    const cm = new ContextManager();
    cm.addMessage({
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'call_1', name: 'bash', input: { command: 'pwd' } },
      ],
    });

    const returned = cm.getMessages();
    returned[0].role = 'user';
    firstToolUseInput(returned[0]).command = 'rm -rf .';

    const fresh = cm.getMessages()[0];
    expect(fresh.role).toBe('assistant');
    expect(firstToolUseInput(fresh).command).toBe('pwd');
  });

  it('stores setMessages copies and returns compact result copies', async () => {
    const cm = new ContextManager({ maxTokens: 80, compactionThreshold: 0.5, preserveRecentMessages: 1 });
    const messages: ChatMessage[] = [
      { role: 'system', content: 'System' },
      { role: 'user', content: 'Old message that will be removed' },
      { role: 'assistant', content: 'Recent message that will stay' },
    ];

    cm.setMessages(messages);
    messages[0].content = 'Injected system';

    const compacted = await cm.compact();
    compacted.kept[0].content = 'Injected kept';
    compacted.removed[0].content = 'Injected removed';

    const fresh = cm.getMessages();
    expect(fresh[0].content).toBe('System');
    expect(fresh.at(-1)?.content).toBe('Recent message that will stay');
  });
});
