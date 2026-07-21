import { describe, expect, it } from 'vitest';
import { ScreenshotExecutor } from '../src/tool/builtins/computer-use';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCall(args: Record<string, unknown>): ToolCall {
  return { id: 'screenshot-call', name: 'screenshot', arguments: args };
}

function makeCtx(result: unknown): ToolContext {
  const platform = createMockPlatform({
    capabilities: { computerUse: true },
  });
  (platform as any).computerUse = {
    invoke: async () => result,
  };
  return { platform, sessionId: 's', workingDir: '/' };
}

describe('Computer Use screenshot result handling', () => {
  it('rejects non-string backend image data before returning image JSON', async () => {
    const result = await new ScreenshotExecutor().execute(
      makeCall({ display: 2 }),
      makeCtx(123),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Screenshot failed');
    expect(result.output).toContain('string');
    expect(() => JSON.parse(result.output)).toThrow();
    expect(result.metadata).toMatchObject({
      displayIndex: 2,
      mimeType: 'image/png',
      dataLength: 0,
    });
  });

  it('rejects empty backend image data before returning image JSON', async () => {
    const result = await new ScreenshotExecutor().execute(
      makeCall({}),
      makeCtx(''),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Screenshot failed');
    expect(result.output).toContain('empty');
    expect(() => JSON.parse(result.output)).toThrow();
    expect(result.metadata).toMatchObject({
      displayIndex: 0,
      mimeType: 'image/png',
      dataLength: 0,
    });
  });
});
