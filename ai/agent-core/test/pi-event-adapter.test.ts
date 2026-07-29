/**
 * PI005 — Pi event adapter `tool_execution_update` → `tool_call_progress` mapping.
 *
 * The adapter's other mappings (text/thinking/toolcall_*) are covered by the
 * e2e + event-ordering suites. This file pins the PI005 streaming-progress
 * mapping (a tool emitting partial output via Pi's onUpdate) so regressions
 * land here first.
 */
import { describe, it, expect } from 'vitest';
import { PiEventAdapter } from '../src/agent/pi-event-adapter';
import { extractPartialText } from '../src/agent/pi-event-helpers';
import type { AgentEvent } from '../src/agent/types';

/** Drain all currently-queued events from the adapter into an array. */
async function drainQueued(adapter: PiEventAdapter): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  while (true) {
    const ev = await adapter.next();
    if (ev === null) break;
    out.push(ev);
  }
  return out;
}

describe('PI005 tool_execution_update → tool_call_progress', () => {
  it('maps a text partialResult to a tool_call_progress event', async () => {
    const adapter = new PiEventAdapter();

    await adapter.handle({
      type: 'tool_execution_update',
      toolCallId: 'call-42',
      toolName: 'bash',
      args: {},
      partialResult: { content: [{ type: 'text', text: 'line 1 of output' }] },
    });
    adapter.close();

    const collected = await drainQueued(adapter);
    const progress = collected.find(
      (e) => e.type === 'tool_call_progress' && e.callId === 'call-42',
    ) as Extract<AgentEvent, { type: 'tool_call_progress' }> | undefined;
    expect(progress).toBeDefined();
    expect(progress?.name).toBe('bash');
    expect(progress?.message).toBe('line 1 of output');
  });

  it('joins multiple text blocks in the partial', () => {
    const text = extractPartialText({
      content: [
        { type: 'text', text: 'a' },
        { type: 'image', url: 'x' },
        { type: 'text', text: 'b' },
      ],
    });
    expect(text).toBe('ab');
  });

  it('returns empty string for a partial without content', () => {
    expect(extractPartialText({})).toBe('');
    expect(extractPartialText(null)).toBe('');
    expect(extractPartialText({ content: 'nope' })).toBe('');
  });
});
