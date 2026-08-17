import { describe, expect, it } from 'vitest';
import type { PublicRuntimeEvent } from '@svton/agent-core';
import { selectTimelineActions } from '../src/timeline/public-event-selector';

const context = { sessionId: 'session', turnId: 'turn', now: () => 42 };

describe('timeline provider fallback selector', () => {
  it('tags only the no-message fallback with a stable semantic code', () => {
    const actions = selectTimelineActions(messageEnd(undefined), context);
    const failure = actions.find((action) => action.type === 'failTurn');
    expect(failure?.item).toMatchObject({
      kind: 'error', code: 'agent_run_failed', diagnostic: 'Agent run failed',
    });
  });

  it('keeps an explicit provider diagnostic byte-exact and generically coded', () => {
    const diagnostic = '动态 provider byte\nline 2';
    const actions = selectTimelineActions(messageEnd(diagnostic), context);
    const failure = actions.find((action) => action.type === 'failTurn');
    expect(failure?.item).toMatchObject({ kind: 'error', code: 'provider', diagnostic });
  });
});

function messageEnd(errorMessage: string | undefined): PublicRuntimeEvent {
  return {
    type: 'message_end',
    message: {
      role: 'assistant', content: [], stopReason: 'error', errorMessage,
      api: 'openai-responses', provider: 'openai', model: 'fixture',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
      timestamp: 1,
    },
  } as PublicRuntimeEvent;
}
