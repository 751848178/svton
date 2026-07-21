/**
 * WebFetchExecutor tests — covering the platform.http integration.
 *
 * Verifies: success, HTTP error, binary content, truncation, and that
 * platform.http is preferred over global fetch.
 */
import { describe, it, expect } from 'vitest';
import { WebFetchExecutor } from '../src/tool/builtins/web';
import { CurlHttpClient } from '../../agent-platform/src/curl-http';
import { createMockPlatform, createMockHttpClient } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';
import type { IProcess, ExecOptions, ExecResult } from '@svton/agent-platform';

function makeCall(url?: string): ToolCall {
  return { id: 'fetch_1', name: 'web_fetch', arguments: url ? { url } : {} };
}
function makeCtx(http?: ReturnType<typeof createMockHttpClient>): ToolContext {
  return { platform: createMockPlatform({ http }), sessionId: 's', workingDir: '/' };
}

function makeCurlBackedCtx(result: ExecResult): ToolContext {
  const process: IProcess = {
    async exec(_command: string, _opts?: ExecOptions): Promise<ExecResult> {
      return result;
    },
    getEnv: () => '',
    getCwd: () => '/',
    spawn: async () => { throw new Error('not used'); },
  };
  return makeCtx(new CurlHttpClient({ process }) as any);
}

describe('WebFetchExecutor (platform.http)', () => {
  it('returns text body on 200 via platform.http', async () => {
    const http = createMockHttpClient([{ json: { hello: 'world' }, headers: { 'content-type': 'application/json' } }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall('https://api.example.com'), makeCtx(http));
    expect(result.isError).toBeUndefined();
    expect(result.output).toContain('hello');
    expect(http.calls[0].url).toBe('https://api.example.com/');
  });

  it('returns text body when platform.http omits content-type', async () => {
    const http = createMockHttpClient([{ body: 'plain body without content type' }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall('https://example.com/plain'), makeCtx(http));
    expect(result.isError).toBeUndefined();
    expect(result.output).toBe('plain body without content type');
    expect(result.output).not.toContain('Binary content');
  });

  it('treats platform.http content type media values case-insensitively', async () => {
    const http = createMockHttpClient([{
      body: '{"ok":true}',
      headers: { 'content-type': 'APPLICATION/JSON' },
    }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall('https://api.example.com/mixed-case'), makeCtx(http));
    expect(result.isError).toBeUndefined();
    expect(result.output).toBe('{"ok":true}');
    expect(result.output).not.toContain('Binary content');
  });

  it('treats JavaScript media types as text', async () => {
    const http = createMockHttpClient([{
      body: 'export const answer = 42;',
      headers: { 'content-type': 'application/javascript' },
    }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall('https://example.com/app.js'), makeCtx(http));
    expect(result.isError).toBeUndefined();
    expect(result.output).toBe('export const answer = 42;');
    expect(result.output).not.toContain('Binary content');
  });

  it('passes the normalized URL to platform.http', async () => {
    const http = createMockHttpClient([{ body: 'ok', headers: { 'content-type': 'text/plain' } }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall(' \nhttps://example.com\t '), makeCtx(http));
    expect(result.isError).toBeUndefined();
    expect(http.calls[0].url).toBe('https://example.com/');
    expect(result.metadata).toMatchObject({ url: 'https://example.com/' });
  });

  it('returns markdown for HTML responses through platform.http', async () => {
    const http = createMockHttpClient([{
      body: '<h2>Guide</h2><p>Open <a href="https://example.com">home</a>.</p>',
      headers: { 'content-type': 'text/html' },
    }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute({
      id: 'fetch_1',
      name: 'web_fetch',
      arguments: { url: 'https://example.com/guide', format: 'markdown' },
    }, makeCtx(http));
    expect(result.isError).toBeUndefined();
    expect(result.output).toContain('## Guide');
    expect(result.output).toContain('[home](https://example.com)');
    expect(result.output).not.toContain('<h2>');
  });

  it('returns error on non-ok status', async () => {
    const http = createMockHttpClient([{
      status: 404,
      body: 'Not Found',
      headers: { 'content-type': 'text/plain' },
    }]);
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall('https://example.com/missing'), makeCtx(http));
    expect(result.isError).toBe(true);
    expect(result.output).toContain('HTTP 404');
    expect(result.metadata).toMatchObject({
      url: 'https://example.com/missing',
      status: 404,
      statusText: 'Error',
      contentType: 'text/plain',
    });
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
    expect(result.metadata).toMatchObject({
      truncated: true,
      originalLength: 60000,
    });
  });

  it('returns error when url missing', async () => {
    const exec = new WebFetchExecutor();
    const result = await exec.execute(makeCall(), makeCtx(createMockHttpClient()));
    expect(result.isError).toBe(true);
    expect(result.output).toContain('"url" is required');
  });

  it('preserves requested format metadata when platform.http throws', async () => {
    const http = createMockHttpClient();
    http.request = async () => {
      throw new Error('network failure');
    };
    const exec = new WebFetchExecutor();
    const result = await exec.execute({
      id: 'fetch_1',
      name: 'web_fetch',
      arguments: { url: ' \nhttps://example.com/guide\t ', format: 'markdown' },
    }, makeCtx(http));

    expect(result.isError).toBe(true);
    expect(result.output).toContain('network failure');
    expect(result.metadata).toMatchObject({
      url: 'https://example.com/guide',
      format: 'markdown',
    });
  });

  it('normalizes non-Error platform.http failures', async () => {
    const http = createMockHttpClient();
    http.request = async () => {
      throw { code: 'network_down' };
    };
    const exec = new WebFetchExecutor();
    const result = await exec.execute({
      id: 'fetch_1',
      name: 'web_fetch',
      arguments: { url: ' \nhttps://example.com/guide\t ', format: 'markdown' },
    }, makeCtx(http));

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Fetch error: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      url: 'https://example.com/guide',
      format: 'markdown',
    });
  });

  it('rejects non-http URLs before calling platform.http', async () => {
    const http = createMockHttpClient([{ body: 'local file' }]);
    const exec = new WebFetchExecutor();
    const fileResult = await exec.execute(makeCall('file:///etc/passwd'), makeCtx(http));
    const ftpResult = await exec.execute(makeCall('ftp://example.com/data'), makeCtx(http));

    expect(fileResult.isError).toBe(true);
    expect(fileResult.output).toContain('http:// or https://');
    expect(ftpResult.isError).toBe(true);
    expect(ftpResult.output).toContain('http:// or https://');
    expect(http.calls).toHaveLength(0);
  });

  it('returns an error when the curl-backed HTTP client exits non-zero', async () => {
    const exec = new WebFetchExecutor();
    const result = await exec.execute(
      makeCall('https://missing.example.test'),
      makeCurlBackedCtx({
        stdout: '',
        stderr: 'Could not resolve host',
        exitCode: 6,
        timedOut: false,
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('HTTP 0');
    expect(result.output).toContain('curl exited with 6');
  });
});
