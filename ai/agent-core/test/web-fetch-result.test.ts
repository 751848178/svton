import { describe, expect, it } from 'vitest';
import { WebFetchExecutor } from '../src/tool/builtins/web';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCall(): ToolCall {
  return {
    id: 'fetch-result',
    name: 'web_fetch',
    arguments: { url: 'https://example.com/data' },
  };
}

function makeCtx(): ToolContext {
  const platform = createMockPlatform({
    http: {
      async request() {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          header(name: string) {
            return name.toLowerCase() === 'content-type' ? 'text/plain' : null;
          },
          async text() {
            return 123 as any;
          },
          async json() {
            return {};
          },
        };
      },
    },
  });
  return { platform, sessionId: 's', workingDir: '/' };
}

describe('web_fetch result handling', () => {
  it('rejects non-string HTTP text bodies before returning success', async () => {
    const result = await new WebFetchExecutor().execute(makeCall(), makeCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Fetch error');
    expect(result.output).toContain('non-string');
    expect(typeof result.output).toBe('string');
    expect(result.metadata).toMatchObject({
      url: 'https://example.com/data',
      format: 'text',
    });
  });
});
