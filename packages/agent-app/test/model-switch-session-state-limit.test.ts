import { describe, expect, it } from 'vitest';
import {
  MODEL_SWITCH_SESSION_STATE_LIMIT,
  releaseSessionValue,
  setBoundedSessionValue,
} from '../src/models/model-switch-session-state';

describe('model switch session state bound', () => {
  it('keeps the current session result and evicts the oldest history', () => {
    let states = new Map<string, string>();
    for (let index = 0; index < MODEL_SWITCH_SESSION_STATE_LIMIT + 8; index += 1) {
      states = setBoundedSessionValue(states, `session-${index}`, `result-${index}`);
    }
    expect(states.size).toBe(MODEL_SWITCH_SESSION_STATE_LIMIT);
    expect(states.has('session-0')).toBe(false);
    expect(states.get(`session-${MODEL_SWITCH_SESSION_STATE_LIMIT + 7}`))
      .toBe(`result-${MODEL_SWITCH_SESSION_STATE_LIMIT + 7}`);
  });

  it('releases only completed latest-request ownership', () => {
    const owners = new Map([['session-a', 'new']]);
    expect(releaseSessionValue(owners, 'session-a', 'old')).toBe(false);
    expect(owners.get('session-a')).toBe('new');
    expect(releaseSessionValue(owners, 'session-a', 'new')).toBe(true);
    expect(owners.size).toBe(0);
  });
});
