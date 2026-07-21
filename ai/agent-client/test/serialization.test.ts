import { describe, it, expect } from 'vitest';
import { deriveTitle, displayToStoredMessages, storedToDisplayMessages } from '../src/hooks/useSession';
import type { DisplayMessage } from '../src/types';

// ==============================================================
// deriveTitle
// ==============================================================

describe('deriveTitle', () => {
  it('returns current title unchanged if it does not start with "Chat "', () => {
    expect(deriveTitle('My Custom Title', [])).toBe('My Custom Title');
    expect(deriveTitle('Hello World', [])).toBe('Hello World');
  });

  it('derives title from first user message when title starts with "Chat "', () => {
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'user', content: 'How do I write a test?', timestamp: 1000 },
    ];
    expect(deriveTitle('Chat 1', messages)).toBe('How do I write a test?');
  });

  it('truncates long user messages to 40 chars with ellipsis', () => {
    const longContent = 'A'.repeat(100);
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'user', content: longContent, timestamp: 1000 },
    ];
    const result = deriveTitle('Chat 1', messages);
    expect(result.length).toBe(43); // 40 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('replaces newlines with spaces', () => {
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'user', content: 'Line 1\nLine 2\nLine 3', timestamp: 1000 },
    ];
    expect(deriveTitle('Chat 1', messages)).toBe('Line 1 Line 2 Line 3');
  });

  it('skips non-user messages and finds first user message', () => {
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'assistant', content: 'I am AI', timestamp: 1000 },
      { id: 'm2', role: 'user', content: 'Real question', timestamp: 1001 },
    ];
    expect(deriveTitle('Chat 1', messages)).toBe('Real question');
  });

  it('returns current title when no user message found', () => {
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'assistant', content: 'I am AI', timestamp: 1000 },
    ];
    expect(deriveTitle('Chat 1', messages)).toBe('Chat 1');
  });

  it('returns current title when user message has empty content', () => {
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'user', content: '', timestamp: 1000 },
    ];
    expect(deriveTitle('Chat 1', messages)).toBe('Chat 1');
  });

  it('handles exactly 40 char content without truncation', () => {
    const content = 'A'.repeat(40);
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'user', content, timestamp: 1000 },
    ];
    expect(deriveTitle('Chat 1', messages)).toBe(content);
  });
});

// ==============================================================
// displayToStoredMessages / storedToDisplayMessages round-trip
// ==============================================================

describe('displayToStoredMessages', () => {
  it('filters out system messages', () => {
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'user', content: 'Hello', timestamp: 1000 },
      { id: 'm2', role: 'system', content: 'Compacted', systemType: 'context_compacted', timestamp: 1001 },
      { id: 'm3', role: 'assistant', content: 'Hi', timestamp: 1002 },
    ];
    const stored = displayToStoredMessages(messages);
    expect(stored).toHaveLength(2);
    expect((stored[0] as any).role).toBe('user');
    expect((stored[1] as any).role).toBe('assistant');
  });

  it('serializes toolCalls with trimmed result', () => {
    const messages: DisplayMessage[] = [
      {
        id: 'm1', role: 'assistant', content: '', timestamp: 1000,
        toolCalls: [{
          id: 'tc1', name: 'read_file', arguments: { path: '/test' }, status: 'completed',
          result: { callId: 'tc1', output: 'file contents', isError: false, metadata: { extra: 'should be stripped' } },
        }],
      },
    ];
    const stored = displayToStoredMessages(messages);
    const tc = (stored[0] as any).toolCalls[0];
    expect(tc.id).toBe('tc1');
    expect(tc.name).toBe('read_file');
    expect(tc.result).toEqual({ callId: 'tc1', output: 'file contents', isError: false });
    // metadata should be stripped
    expect(tc.result.metadata).toBeUndefined();
  });

  it('serializes blocks with tool_call blocks trimmed', () => {
    const messages: DisplayMessage[] = [
      {
        id: 'm1', role: 'assistant', content: 'Check this', timestamp: 1000,
        blocks: [
          { type: 'text', text: 'Check this' },
          { type: 'tool_call', call: { id: 'tc1', name: 'test', arguments: {}, status: 'completed' as const, result: { callId: 'tc1', output: 'ok' } } },
        ],
      },
    ];
    const stored = displayToStoredMessages(messages);
    const blocks = (stored[0] as any).blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('text');
    expect(blocks[1].type).toBe('tool_call');
    expect(blocks[1].call.id).toBe('tc1');
    // result trimmed
    expect(blocks[1].call.result).toEqual({ callId: 'tc1', output: 'ok' });
  });

  it('preserves thinking field', () => {
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'assistant', content: 'Answer', thinking: 'Deep thoughts...', timestamp: 1000 },
    ];
    const stored = displayToStoredMessages(messages);
    expect((stored[0] as any).thinking).toBe('Deep thoughts...');
  });

  it('preserves images field', () => {
    const messages: DisplayMessage[] = [
      {
        id: 'm1', role: 'user', content: 'Look at this', timestamp: 1000,
        images: [{ data: 'base64data', mimeType: 'image/png' }],
      },
    ];
    const stored = displayToStoredMessages(messages);
    expect((stored[0] as any).images).toEqual([{ data: 'base64data', mimeType: 'image/png' }]);
  });

  it('preserves duration field', () => {
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'assistant', content: 'Fast', duration: 1234, timestamp: 1000 },
    ];
    const stored = displayToStoredMessages(messages);
    expect((stored[0] as any).duration).toBe(1234);
  });

  it('omits thinking/images/duration when undefined', () => {
    const messages: DisplayMessage[] = [
      { id: 'm1', role: 'user', content: 'Hello', timestamp: 1000 },
    ];
    const stored = displayToStoredMessages(messages);
    expect((stored[0] as any).thinking).toBeUndefined();
    expect((stored[0] as any).images).toBeUndefined();
    expect((stored[0] as any).duration).toBeUndefined();
  });
});

describe('storedToDisplayMessages', () => {
  it('restores basic messages', () => {
    const stored = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    const restored = storedToDisplayMessages(stored);
    expect(restored).toHaveLength(2);
    expect(restored[0].role).toBe('user');
    expect(restored[0].content).toBe('Hello');
    expect(restored[1].role).toBe('assistant');
    expect(restored[1].content).toBe('Hi there');
  });

  it('restores toolCalls with correct types', () => {
    const stored = [
      {
        role: 'assistant', content: ' ',
        toolCalls: [{
          id: 'tc1', name: 'read_file', arguments: { path: '/a' }, status: 'completed',
          result: { callId: 'tc1', output: 'ok', isError: false },
        }],
      },
    ];
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].toolCalls).toHaveLength(1);
    expect(restored[0].toolCalls![0].status).toBe('completed');
    expect(restored[0].toolCalls![0].result!.isError).toBe(false);
  });

  it('restores thinking field', () => {
    const stored = [
      { role: 'assistant', content: 'Answer', thinking: 'I pondered...' },
    ];
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].thinking).toBe('I pondered...');
  });

  it('restores images', () => {
    const stored = [
      { role: 'user', content: 'See this', images: [{ data: 'abc', mimeType: 'image/png' }] },
    ];
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].images).toEqual([{ data: 'abc', mimeType: 'image/png' }]);
  });

  it('restores blocks with tool_call blocks', () => {
    const stored = [
      {
        role: 'assistant', content: 'result',
        blocks: [
          { type: 'text', text: 'Let me check' },
          { type: 'tool_call', call: { id: 'tc1', name: 'test', arguments: {}, status: 'completed' } },
        ],
      },
    ];
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].blocks).toHaveLength(2);
    expect(restored[0].blocks![1].type).toBe('tool_call');
  });

  it('rebuilds blocks from thinking + toolCalls when no stored blocks', () => {
    const stored = [
      {
        role: 'assistant', content: 'done',
        thinking: 'Let me think...',
        toolCalls: [{ id: 'tc1', name: 'test', arguments: {}, status: 'completed' }],
      },
    ];
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].blocks).toHaveLength(2);
    expect(restored[0].blocks![0].type).toBe('thinking');
    expect(restored[0].blocks![1].type).toBe('tool_call');
  });

  it('skips entries without role (but keeps empty-content assistant messages)', () => {
    const stored = [
      { role: 'user', content: 'Valid' },
      { role: 'assistant' }, // missing content → kept (content defaults to '')
      { content: 'No role' }, // missing role → skipped
    ];
    const restored = storedToDisplayMessages(stored);
    // 'No role' is dropped, but 'assistant' with no content is kept
    expect(restored).toHaveLength(2);
    expect(restored[0].content).toBe('Valid');
    expect(restored[1].role).toBe('assistant');
    expect(restored[1].content).toBe('');
  });

  it('filters out tool_call blocks with no call data', () => {
    const stored = [
      {
        role: 'assistant', content: 'Result',
        blocks: [
          { type: 'text', text: 'Result' },
          { type: 'tool_call' }, // no call data
        ],
      },
    ];
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].blocks).toHaveLength(1);
    expect(restored[0].blocks![0].type).toBe('text');
  });

  it('round-trips: display → stored → display preserves key data', () => {
    const original: DisplayMessage[] = [
      { id: 'm1', role: 'user', content: 'Hello', timestamp: 1000 },
      {
        id: 'm2', role: 'assistant', content: 'Hi', thinking: 'Thinking...', duration: 500, timestamp: 1001,
        toolCalls: [{
          id: 'tc1', name: 'test', arguments: { x: 1 }, status: 'completed',
          result: { callId: 'tc1', output: 'done' },
        }],
      },
    ];
    const stored = displayToStoredMessages(original);
    const restored = storedToDisplayMessages(stored);

    expect(restored).toHaveLength(2);
    expect(restored[0].role).toBe('user');
    expect(restored[0].content).toBe('Hello');
    expect(restored[1].role).toBe('assistant');
    expect(restored[1].content).toBe('Hi');
    expect(restored[1].thinking).toBe('Thinking...');
    expect(restored[1].duration).toBe(500);
    expect(restored[1].toolCalls).toHaveLength(1);
    expect(restored[1].toolCalls![0].name).toBe('test');
    expect(restored[1].toolCalls![0].status).toBe('completed');
  });

  it('round-trips activeSkills through display → stored → display', () => {
    const original: DisplayMessage[] = [
      {
        id: 'm1', role: 'assistant', content: 'reviewing', timestamp: 1,
        activeSkills: ['code-review', 'plan-before-code'],
      },
    ];
    const restored = storedToDisplayMessages(displayToStoredMessages(original));
    expect(restored[0].activeSkills).toEqual(['code-review', 'plan-before-code']);
  });

  it('round-trips activeSkills=undefined as omitted (not an empty array)', () => {
    const original: DisplayMessage[] = [
      { id: 'm1', role: 'assistant', content: 'hi', timestamp: 1 },
    ];
    const stored = displayToStoredMessages(original);
    // activeSkills is undefined → not serialised as a key
    expect((stored[0] as Record<string, unknown>).activeSkills).toBeUndefined();
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].activeSkills).toBeUndefined();
  });

  it('round-trips pending tool call approval metadata', () => {
    const autoReviewVerdict = {
      verdict: 'ask_user',
      reason: 'No matching rule',
    };
    const original: DisplayMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '',
        timestamp: 1,
        toolCalls: [{
          id: 'tc-meta',
          name: 'bash',
          arguments: { command: 'rm -rf /tmp/x' },
          status: 'pending_approval',
          metadata: { autoReviewVerdict },
        }],
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-meta',
            name: 'bash',
            arguments: { command: 'rm -rf /tmp/x' },
            status: 'pending_approval',
            metadata: { autoReviewVerdict },
          },
        }],
      },
    ];

    const stored = displayToStoredMessages(original);
    expect((stored[0] as any).toolCalls[0].metadata?.autoReviewVerdict).toEqual(autoReviewVerdict);
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].toolCalls![0].metadata?.autoReviewVerdict).toEqual(autoReviewVerdict);
    expect((restored[0].blocks![0] as any).call.metadata?.autoReviewVerdict).toEqual(autoReviewVerdict);
  });

  it('round-trips auto-review metadata on completed tool results', () => {
    const autoReviewVerdict = {
      verdict: 'deny',
      reason: 'Dangerous command',
      ruleId: 'deny-rm',
    };
    const original: DisplayMessage[] = [
      {
        id: 'm1',
        role: 'assistant',
        content: '',
        timestamp: 1,
        toolCalls: [{
          id: 'tc-result-meta',
          name: 'bash',
          arguments: { command: 'rm -rf /tmp/x' },
          status: 'error',
          result: {
            callId: 'tc-result-meta',
            output: 'Auto-reviewer denied: Dangerous command',
            isError: true,
            metadata: { autoReviewVerdict },
          },
        }],
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-result-meta',
            name: 'bash',
            arguments: { command: 'rm -rf /tmp/x' },
            status: 'error',
            result: {
              callId: 'tc-result-meta',
              output: 'Auto-reviewer denied: Dangerous command',
              isError: true,
              metadata: { autoReviewVerdict },
            },
          },
        }],
      },
    ];

    const stored = displayToStoredMessages(original);
    expect((stored[0] as any).toolCalls[0].result.metadata?.autoReviewVerdict).toEqual(autoReviewVerdict);
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].toolCalls![0].result?.metadata?.autoReviewVerdict).toEqual(autoReviewVerdict);
    expect((restored[0].blocks![0] as any).call.result.metadata?.autoReviewVerdict).toEqual(autoReviewVerdict);
  });

  it('restores auto_review blocks from legacy tool result metadata', () => {
    const restored = storedToDisplayMessages([
      {
        role: 'assistant',
        content: '',
        toolCalls: [{
          id: 'tc-legacy-review',
          name: 'bash',
          arguments: { command: 'rm -rf /tmp/x' },
          status: 'error',
          result: {
            callId: 'tc-legacy-review',
            output: 'Auto-reviewer denied: Dangerous command',
            isError: true,
            metadata: {
              autoReviewVerdict: {
                verdict: 'deny',
                reason: 'Dangerous command',
                ruleId: 'deny-rm',
              },
            },
          },
        }],
      },
    ]);

    expect(restored[0].blocks).toEqual([
      expect.objectContaining({
        type: 'tool_call',
        call: expect.objectContaining({ id: 'tc-legacy-review' }),
      }),
      {
        type: 'auto_review',
        toolName: 'bash',
        verdict: 'deny',
        reason: 'Dangerous command',
        ruleId: 'deny-rm',
      },
    ]);
  });

  it('backfills auto_review blocks when stored blocks only contain tool calls', () => {
    const restored = storedToDisplayMessages([
      {
        role: 'assistant',
        content: '',
        blocks: [{
          type: 'tool_call',
          call: {
            id: 'tc-block-review',
            name: 'bash',
            arguments: { command: 'rm -rf /tmp/x' },
            status: 'error',
            result: {
              callId: 'tc-block-review',
              output: 'Auto-reviewer denied: Dangerous command',
              isError: true,
              metadata: {
                autoReviewVerdict: {
                  verdict: 'deny',
                  reason: 'Dangerous command',
                  ruleId: 'deny-rm',
                },
              },
            },
          },
        }],
      },
    ]);

    expect(restored[0].blocks).toEqual([
      expect.objectContaining({
        type: 'tool_call',
        call: expect.objectContaining({ id: 'tc-block-review' }),
      }),
      {
        type: 'auto_review',
        toolName: 'bash',
        verdict: 'deny',
        reason: 'Dangerous command',
        ruleId: 'deny-rm',
      },
    ]);
  });

  it('generates unique IDs for restored messages', () => {
    const stored = [
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'B' },
    ];
    const restored = storedToDisplayMessages(stored);
    expect(restored[0].id).not.toBe(restored[1].id);
    expect(restored[0].id).toMatch(/^restored_\d+_/);
  });
});
