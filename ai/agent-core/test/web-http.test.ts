/**
 * WebFetchExecutor tests — covering the platform.http integration.
 *
 * Verifies: success, HTTP error, binary content, truncation, and that
 * platform.http is preferred over global fetch.
 */
import { describe, it, expect } from 'vitest';
import { WebFetchExecutor } from '../src/tool/builtins/web';
import { createMockPlatform, createMockHttpClient } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

function makeCall(url?: string): ToolCall {
  return { id: 'fetch_1', name: 'web_fetch', arguments: url ? { url } : {} };
}
function makeCtx(http?: ReturnType<typeof createMockHttpClient>): ToolContext {
  return { platform: createMockPlatform({ http }), sessionId: 's', workingDir: '/' };
}

describe('WebFetchExecutor (platform.http)', () => {
  it('returns text body on 200 via platform.http', async () => {
    const http = createMockHttpClient([{ json: { hello: 'world' }, headers: { 'content-type': 'application/json' } }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall('https://api.example.com'), makeCtx(http));
    expect(result.isError).toBeUndefined();
    expect(result.output).toContain('hello');
    expect(http.calls[0].url).toBe('https://api.example.com');
  });

  it('returns error on non-ok status', async () => {
    const http = createMockHttpClient([{ status: 404, body: 'Not Found' }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall('https://example.com/missing'), makeCtx(http));
    expect(result.isError).toBe(true);
    expect(result.output).toContain('HTTP 404');
  });

  it('reports binary content for non-text content-type', async () => {
    const http = createMockHttpClient([{ body: 'BIN', headers: { 'content-type': 'image/png', 'content-length': '3' } }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall('https://example.com/img.png'), makeCtx(http));
    expect(result.output).toContain('Binary content');
    expect(result.output).toContain('image/png');
  });

  it('truncates responses larger than 50000 chars', async () => {
    const big = 'x'.repeat(60000);
    const http = createMockHttpClient([{ body: big, headers: { 'content-type': 'text/html' } }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall('https://example.com/big'), makeCtx(http));
    expect(result.output.length).toBeLessThan(60000);
    expect(result.output).toContain('truncated');
  });

  it('returns error when url missing', async () => {
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall(), makeCtx(createMockHttpClient()));
    expect(result.isError).toBe(true);
    expect(result.output).toContain('"url" is required');
  });
});
