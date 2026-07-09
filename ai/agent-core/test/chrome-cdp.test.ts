/**
 * Chrome CDP executor tests.
 *
 * Uses the `__setCdpClientForTesting` hook to inject a mock CDP client that
 * records the methods called and returns canned results. This verifies each
 * executor issues the correct CDP commands and formats results — without a
 * real Chrome instance or WebSocket.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ChromeNavigateExecutor,
  ChromeScreenshotExecutor,
  ChromeClickExecutor,
  ChromeTypeExecutor,
  ChromeEvaluateExecutor,
  ChromeGetContentExecutor,
  __setCdpClientForTesting,
} from '../src/tool/builtins/chrome';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';

/** Mock CDP client: records calls, returns scripted responses per method. */
function mockCdpClient(responses: Record<string, (params: Record<string, unknown>) => any> = {}) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  return {
    calls,
    async send(method: string, params: Record<string, unknown> = {}): Promise<any> {
      calls.push({ method, params });
      const handler = responses[method];
      if (handler) return handler(params);
      return {};
    },
  };
}

const ctx: ToolContext = {
  platform: createMockPlatform(),
  sessionId: 's',
  workingDir: '/',
};

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: 'c1', name, arguments: args };
}

describe('Chrome CDP executors', () => {
  beforeEach(() => {
    __setCdpClientForTesting(null); // reset between tests
  });

  it('navigate sends Page.navigate with url', async () => {
    const client = mockCdpClient();
    __setCdpClientForTesting(client);
    const result = await new ChromeNavigateExecutor().execute(
      makeCall('chrome_navigate', { url: 'https://example.com' }),
      ctx,
    );
    expect(client.calls.some((c) => c.method === 'Page.navigate' && c.params.url === 'https://example.com')).toBe(true);
    expect(result.output).toContain('https://example.com');
  });

  it('screenshot sends Page.captureScreenshot and returns image JSON', async () => {
    const client = mockCdpClient({
      'Page.captureScreenshot': () => ({ data: 'BASE64PNG' }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeScreenshotExecutor().execute(
      makeCall('chrome_screenshot', {}),
      ctx,
    );
    const parsed = JSON.parse(result.output);
    expect(parsed.type).toBe('image');
    expect(parsed.data).toBe('BASE64PNG');
  });

  it('click finds element via DOM.querySelector and dispatches mouse events', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': (p) => ({ nodeId: p.selector === '#btn' ? 42 : 0 }),
      'DOM.getBoxModel': () => ({ model: { content: [0, 0, 100, 0, 100, 100, 0, 100] } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeClickExecutor().execute(
      makeCall('chrome_click', { selector: '#btn' }),
      ctx,
    );
    expect(result.output).toContain('Clicked element "#btn"');
    // verify mouse pressed + released dispatched
    const methods = client.calls.map((c) => c.method);
    expect(methods).toContain('Input.dispatchMouseEvent');
  });

  it('click returns error when element not found', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': () => ({ nodeId: 0 }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeClickExecutor().execute(
      makeCall('chrome_click', { selector: '.missing' }),
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('not found');
  });

  it('type sends Input.insertText', async () => {
    const client = mockCdpClient();
    __setCdpClientForTesting(client);
    const result = await new ChromeTypeExecutor().execute(
      makeCall('chrome_type', { text: 'hello world' }),
      ctx,
    );
    expect(client.calls[0]).toEqual({ method: 'Input.insertText', params: { text: 'hello world' } });
    expect(result.output).toContain('hello world');
  });

  it('evaluate returns the JS result value', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: 42 } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeEvaluateExecutor().execute(
      makeCall('chrome_evaluate', { expression: '6 * 7' }),
      ctx,
    );
    expect(result.output).toBe('42');
  });

  it('evaluate reports JS exceptions', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ exceptionDetails: { text: 'ReferenceError: x is not defined' } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeEvaluateExecutor().execute(
      makeCall('chrome_evaluate', { expression: 'x' }),
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('ReferenceError');
  });

  it('get_content returns innerText of the selector', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: 'Page body text' } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeGetContentExecutor().execute(
      makeCall('chrome_get_content', {}),
      ctx,
    );
    expect(result.output).toBe('Page body text');
  });

  it('get_content truncates very long text', async () => {
    const long = 'x'.repeat(12000);
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: long } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeGetContentExecutor().execute(
      makeCall('chrome_get_content', {}),
      ctx,
    );
    expect(result.output).toContain('truncated');
    expect(result.output.length).toBeLessThan(12000);
  });

  it('returns error when CDP send throws (no Chrome running)', async () => {
    const client = {
      calls: [] as any[],
      async send() { throw new Error('WebSocket connection failed'); },
    };
    __setCdpClientForTesting(client);
    const result = await new ChromeNavigateExecutor().execute(
      makeCall('chrome_navigate', { url: 'https://x.com' }),
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('WebSocket connection failed');
  });
});
