import { describe, expect, it } from 'vitest';
import {
  KeyboardPressKeyExecutor,
  KeyboardTypeExecutor,
} from '../src/tool/builtins/computer-use';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: name, name, arguments: args };
}

function makeThrowingCtx(): ToolContext {
  const platform = createMockPlatform({ capabilities: { computerUse: true } });
  (platform as any).computerUse = {
    invoke: async () => {
      throw { code: 'backend_down' };
    },
  };

  return { platform, sessionId: 'session', workingDir: '/' };
}

describe('computer-use keyboard backend error formatting', () => {
  it('normalizes non-Error keyboard_type failures', async () => {
    const result = await new KeyboardTypeExecutor().execute(
      makeCall('keyboard_type', { text: 'hello' }),
      makeThrowingCtx(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Keyboard type failed: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({ textLength: 5, truncated: false });
  });

  it('normalizes non-Error keyboard_press_key failures', async () => {
    const result = await new KeyboardPressKeyExecutor().execute(
      makeCall('keyboard_press_key', { key: ' Enter ', modifiers: ['Ctrl'] }),
      makeThrowingCtx(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Key press failed: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({ key: 'enter', modifiers: ['ctrl'] });
  });
});
