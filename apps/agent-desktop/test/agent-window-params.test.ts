import { describe, expect, it } from 'vitest';
import { parseAgentWindowParams } from '../src/lib/agent-window-params.utils';

describe('agent window params', () => {
  it('preserves the session selected for a Tauri popout window', () => {
    expect(parseAgentWindowParams('?session=session-b&popout=1')).toEqual({
      isPreview: false,
      isPopout: true,
      sessionId: 'session-b',
    });
  });

  it('does not invent a session for preview or main windows', () => {
    expect(parseAgentWindowParams('?preview=1').sessionId).toBeUndefined();
    expect(parseAgentWindowParams('').sessionId).toBeUndefined();
  });
});
