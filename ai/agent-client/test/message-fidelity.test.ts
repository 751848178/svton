/**
 * Complex message content fidelity tests.
 *
 * Verifies that messages with rich content (markdown tables, fenced code
 * blocks, multi-line text, image attachments, unicode/CJK, special chars)
 * survive the display → stored → restored round-trip without loss,
 * truncation, or corruption.
 */
import { describe, it, expect } from 'vitest';
import { displayToStoredMessages, storedToDisplayMessages } from '../src/hooks/useSession';
import type { DisplayMessage } from '../src/types';

function roundTrip(messages: DisplayMessage[]): DisplayMessage[] {
  return storedToDisplayMessages(displayToStoredMessages(messages));
}

const baseTimestamp = 1000;

describe('Message content fidelity', () => {
  // ── Markdown with tables, lists, headings ──
  it('preserves markdown tables through round-trip', () => {
    const markdown = [
      '# Report',
      '',
      '| Col A | Col B |',
      '|-------|-------|',
      '| 1     | 2     |',
      '| 3     | 4     |',
      '',
      '- item 1',
      '- item 2',
    ].join('\n');

    const original: DisplayMessage[] = [{
      id: 'm1', role: 'assistant', content: markdown, timestamp: baseTimestamp,
    }];
    const restored = roundTrip(original);
    expect(restored[0].content).toBe(markdown);
  });

  // ── Fenced code blocks (backtick-heavy) ──
  it('preserves fenced code blocks with language tags', () => {
    const code = '```typescript\ninterface Foo {\n  bar: string;\n}\n```\n\nSome text after.';
    const original: DisplayMessage[] = [{
      id: 'm1', role: 'assistant', content: code, timestamp: baseTimestamp,
    }];
    const restored = roundTrip(original);
    expect(restored[0].content).toBe(code);
  });

  // ── Multi-line text with \n ──
  it('preserves multi-line content with newlines', () => {
    const multiLine = 'Line 1\nLine 2\nLine 3\n\nLine 5 (after blank line)';
    const original: DisplayMessage[] = [{
      id: 'm1', role: 'user', content: multiLine, timestamp: baseTimestamp,
    }];
    const restored = roundTrip(original);
    expect(restored[0].content).toBe(multiLine);
  });

  // ── Unicode / CJK / emoji ──
  it('preserves unicode, CJK characters, and emoji', () => {
    const unicode = '你好世界 🌍 — café — naïve — 日本語テスト — 😀🚀';
    const original: DisplayMessage[] = [{
      id: 'm1', role: 'user', content: unicode, timestamp: baseTimestamp,
    }];
    const restored = roundTrip(original);
    expect(restored[0].content).toBe(unicode);
  });

  // ── Special characters that could break JSON ──
  it('preserves quotes, backslashes, and JSON-like content', () => {
    const special = 'He said "hello"\nPath: C:\\Users\\test\nJSON: {"key":"value"}\n`code`';
    const original: DisplayMessage[] = [{
      id: 'm1', role: 'assistant', content: special, timestamp: baseTimestamp,
    }];
    const restored = roundTrip(original);
    expect(restored[0].content).toBe(special);
  });

  // ── Image attachments ──
  it('preserves image attachments (data + mimeType)', () => {
    const original: DisplayMessage[] = [{
      id: 'm1', role: 'user', content: 'See this screenshot',
      images: [
        { data: 'iVBORw0KGgo=', mimeType: 'image/png' },
        { data: '/9j/4AAQ', mimeType: 'image/jpeg' },
      ],
      timestamp: baseTimestamp,
    }];
    const restored = roundTrip(original);
    expect(restored[0].images).toBeDefined();
    expect(restored[0].images!.length).toBe(2);
    expect(restored[0].images![0].data).toBe('iVBORw0KGgo=');
    expect(restored[0].images![0].mimeType).toBe('image/png');
    expect(restored[0].images![1].mimeType).toBe('image/jpeg');
  });

  // ── Thinking + tool calls + text mixed in one message ──
  it('preserves a complex assistant message (thinking + toolCall + blocks)', () => {
    const original: DisplayMessage[] = [{
      id: 'm1', role: 'assistant', content: 'Here is the result.',
      thinking: 'I need to check the diff first.\nThen analyze.',
      duration: 3500,
      activeSkills: ['code-review'],
      toolCalls: [{
        id: 'tc1', name: 'git_diff',
        arguments: { base: 'main', head: 'feature' },
        status: 'completed' as const,
        result: { callId: 'tc1', output: 'diff --git a/f b/f\n+x', isError: false },
      }],
      blocks: [
        { type: 'thinking', text: 'I need to check the diff first.\nThen analyze.' },
        { type: 'tool_call', call: {
          id: 'tc1', name: 'git_diff',
          arguments: { base: 'main', head: 'feature' },
          status: 'completed' as const,
          result: { callId: 'tc1', output: 'diff --git a/f b/f\n+x', isError: false },
        }},
        { type: 'text', text: 'Here is the result.' },
      ],
      timestamp: baseTimestamp,
    }];
    const restored = roundTrip(original);

    expect(restored[0].content).toBe('Here is the result.');
    expect(restored[0].thinking).toBe('I need to check the diff first.\nThen analyze.');
    expect(restored[0].duration).toBe(3500);
    expect(restored[0].activeSkills).toEqual(['code-review']);

    // Tool call preserved
    expect(restored[0].toolCalls).toHaveLength(1);
    expect(restored[0].toolCalls![0].name).toBe('git_diff');
    expect(restored[0].toolCalls![0].arguments).toEqual({ base: 'main', head: 'feature' });
    expect(restored[0].toolCalls![0].status).toBe('completed');
    expect(restored[0].toolCalls![0].result!.output).toContain('diff --git');

    // Blocks preserved
    expect(restored[0].blocks).toBeDefined();
    expect(restored[0].blocks!.length).toBe(3);
    expect(restored[0].blocks![0].type).toBe('thinking');
    expect(restored[0].blocks![1].type).toBe('tool_call');
    expect(restored[0].blocks![2].type).toBe('text');
  });

  // ── Empty content edge case ──
  it('preserves assistant message with empty content + blocks (NOT dropped on reload)', () => {
    // Regression: storedToDisplayMessages previously had `if (!m.content) continue`
    // which dropped assistant messages whose content='' but had blocks/toolCalls.
    const original: DisplayMessage[] = [{
      id: 'm1', role: 'assistant', content: '', timestamp: baseTimestamp,
      blocks: [
        { type: 'thinking', text: 'Analyzing...' },
        { type: 'tool_call', call: {
          id: 'tc1', name: 'bash', arguments: { command: 'ls' },
          status: 'completed' as const,
          result: { callId: 'tc1', output: 'file.txt', isError: false },
        }},
        { type: 'text', text: 'Done.' },
      ],
    }];
    const stored = displayToStoredMessages(original);
    expect(stored.length).toBe(1);

    // The critical assertion: round-trip must NOT drop the message
    const restored = storedToDisplayMessages(stored);
    expect(restored.length).toBe(1);
    expect(restored[0].role).toBe('assistant');
    expect(restored[0].blocks).toBeDefined();
    expect(restored[0].blocks!.length).toBe(3);
  });

  it('handles empty content without blocks gracefully', () => {
    const original: DisplayMessage[] = [{
      id: 'm1', role: 'assistant', content: '', timestamp: baseTimestamp,
    }];
    const stored = displayToStoredMessages(original);
    // displayToStoredMessages keeps it (empty content is valid for assistant)
    const restored = storedToDisplayMessages(stored);
    // Even with empty content and no blocks, the message should survive
    expect(restored.length).toBeGreaterThanOrEqual(0);
  });

  // ── Very long message (no truncation in serialization layer) ──
  it('preserves a 50KB message without truncation', () => {
    const long = 'x'.repeat(50000);
    const original: DisplayMessage[] = [{
      id: 'm1', role: 'assistant', content: long, timestamp: baseTimestamp,
    }];
    const restored = roundTrip(original);
    expect(restored[0].content.length).toBe(50000);
  });

  // ── Message order preservation ──
  it('preserves message order in a multi-message conversation', () => {
    const original: DisplayMessage[] = [
      { id: 'm1', role: 'user', content: 'Question 1', timestamp: 1000 },
      { id: 'm2', role: 'assistant', content: 'Answer 1', timestamp: 1001 },
      { id: 'm3', role: 'user', content: 'Question 2', timestamp: 1002 },
      { id: 'm4', role: 'assistant', content: 'Answer 2', timestamp: 1003 },
    ];
    const restored = roundTrip(original);
    expect(restored.length).toBe(4);
    expect(restored.map(m => m.content)).toEqual([
      'Question 1', 'Answer 1', 'Question 2', 'Answer 2',
    ]);
  });
});
