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
import { chromeCtx, makeChromeCall, mockCdpClient } from './chrome-cdp-test-utils';

describe('Chrome CDP executors', () => {
  beforeEach(() => {
    __setCdpClientForTesting(null); // reset between tests
  });

  it('navigate sends Page.navigate with url', async () => {
    const client = mockCdpClient();
    __setCdpClientForTesting(client);
    const result = await new ChromeNavigateExecutor().execute(
      makeChromeCall('chrome_navigate', { url: 'https://example.com' }),
      chromeCtx,
    );
    expect(client.calls.some((c) => c.method === 'Page.navigate' && c.params.url === 'https://example.com')).toBe(true);
    expect(result.output).toContain('https://example.com');
  });

  it('navigate rejects blank url before CDP navigation', async () => {
    const client = mockCdpClient();
    __setCdpClientForTesting(client);

    const result = await new ChromeNavigateExecutor().execute(
      makeChromeCall('chrome_navigate', { url: ' \n\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"url" is required and must be a string');
    expect(client.calls).toHaveLength(0);
  });

  it('navigate uses trimmed url for CDP navigation', async () => {
    const client = mockCdpClient();
    __setCdpClientForTesting(client);

    const result = await new ChromeNavigateExecutor().execute(
      makeChromeCall('chrome_navigate', { url: ' \nhttps://example.com\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBeFalsy();
    expect(client.calls.some((c) => c.method === 'Page.navigate' && c.params.url === 'https://example.com')).toBe(true);
    expect(result.output).toContain('https://example.com');
  });

  it('navigate treats Page.navigate errorText as navigation failure', async () => {
    const client = mockCdpClient({
      'Page.navigate': () => ({ errorText: 'net::ERR_NAME_NOT_RESOLVED' }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeNavigateExecutor().execute(
      makeChromeCall('chrome_navigate', { url: 'https://missing.example' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('net::ERR_NAME_NOT_RESOLVED');
    expect(result.output).toContain('https://missing.example');
    expect(result.metadata).toMatchObject({
      url: 'https://missing.example',
      errorText: 'net::ERR_NAME_NOT_RESOLVED',
    });
  });

  it('navigate preserves url metadata when CDP navigation throws', async () => {
    const client = mockCdpClient({
      'Page.navigate': () => {
        throw new Error('cdp unavailable');
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeNavigateExecutor().execute(
      makeChromeCall('chrome_navigate', { url: ' \nhttps://example.com\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('cdp unavailable');
    expect(result.metadata).toMatchObject({
      url: 'https://example.com',
    });
  });

  it('screenshot sends Page.captureScreenshot and returns image JSON', async () => {
    const client = mockCdpClient({
      'Page.captureScreenshot': () => ({ data: 'BASE64PNG' }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeScreenshotExecutor().execute(
      makeChromeCall('chrome_screenshot', {}),
      chromeCtx,
    );
    const parsed = JSON.parse(result.output);
    expect(client.calls).toEqual([
      { method: 'Page.captureScreenshot', params: { format: 'png', captureBeyondViewport: false } },
    ]);
    expect(parsed.type).toBe('image');
    expect(parsed.data).toBe('BASE64PNG');
    expect(parsed.mimeType).toBe('image/png');
    expect(result.metadata).toMatchObject({
      fullPage: false,
      mimeType: 'image/png',
      dataLength: 9,
    });
  });

  it('screenshot rejects non-boolean fullPage before CDP capture', async () => {
    const client = mockCdpClient({
      'Page.captureScreenshot': () => ({ data: 'BASE64PNG' }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeScreenshotExecutor().execute(
      makeChromeCall('chrome_screenshot', { fullPage: 'true' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"fullPage" must be a boolean');
    expect(client.calls).toHaveLength(0);
  });

  it('click finds element via DOM.querySelector and dispatches mouse events', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': (p) => ({ nodeId: p.selector === '#btn' ? 42 : 0 }),
      'DOM.getBoxModel': () => ({ model: { content: [0, 0, 100, 0, 100, 100, 0, 100] } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: '#btn' }),
      chromeCtx,
    );
    expect(result.output).toContain('Clicked element "#btn"');
    // verify mouse pressed + released dispatched
    const methods = client.calls.map((c) => c.method);
    expect(methods).toContain('Input.dispatchMouseEvent');
  });

  it('click rejects blank selector before DOM lookup', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': () => ({ nodeId: 42 }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: ' \n\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"selector" is required and must be a string');
    expect(client.calls).toHaveLength(0);
  });

  it('click uses the full content quad center for skewed elements', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': () => ({ nodeId: 42 }),
      'DOM.getBoxModel': () => ({ model: { content: [0, 0, 100, 10, 90, 110, -10, 100] } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: '#skewed' }),
      chromeCtx,
    );

    const mouseEvents = client.calls.filter((c) => c.method === 'Input.dispatchMouseEvent');
    expect(mouseEvents).toHaveLength(2);
    expect(mouseEvents[0].params).toMatchObject({ x: 45, y: 55 });
    expect(mouseEvents[1].params).toMatchObject({ x: 45, y: 55 });
    expect(result.metadata).toMatchObject({ selector: '#skewed', x: 45, y: 55, button: 'left' });
  });

  it('click uses trimmed selector for DOM lookup and reporting', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': (p) => ({ nodeId: p.selector === '#btn' ? 42 : 0 }),
      'DOM.getBoxModel': () => ({ model: { content: [0, 0, 100, 0, 100, 100, 0, 100] } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: ' \n#btn\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBeFalsy();
    expect(client.calls.some((c) => c.method === 'DOM.querySelector' && c.params.selector === '#btn')).toBe(true);
    expect(result.output).toContain('Clicked element "#btn"');
  });

  it('click returns error when element not found', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': () => ({ nodeId: 0 }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: '.missing' }),
      chromeCtx,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('not found');
    expect(result.metadata).toMatchObject({
      selector: '.missing',
    });
  });

  it('type sends Input.insertText', async () => {
    const client = mockCdpClient();
    __setCdpClientForTesting(client);
    const result = await new ChromeTypeExecutor().execute(
      makeChromeCall('chrome_type', { text: 'secret hello world' }),
      chromeCtx,
    );
    expect(client.calls[0]).toEqual({ method: 'Input.insertText', params: { text: 'secret hello world' } });
    expect(result.output).not.toContain('secret hello world');
    expect(result.metadata).toMatchObject({ textLength: 18 });
  });

  it('type preserves text length metadata when CDP insertion throws', async () => {
    const client = mockCdpClient({
      'Input.insertText': () => {
        throw new Error('insert failed');
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeTypeExecutor().execute(
      makeChromeCall('chrome_type', { text: 'secret hello world' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('insert failed');
    expect(result.output).not.toContain('secret hello world');
    expect(result.metadata).toMatchObject({ textLength: 18 });
  });

  it('evaluate returns the JS result value', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: 42 } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: '6 * 7' }),
      chromeCtx,
    );
    expect(result.output).toBe('42');
  });

  it('evaluate preserves JavaScript undefined results', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { type: 'undefined' } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: 'window.missingValue' }),
      chromeCtx,
    );
    expect(result.output).toBe('undefined');
    expect(result.metadata).toMatchObject({ resultType: 'undefined' });
  });

  it('evaluate preserves Chrome unserializable values', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { type: 'number', unserializableValue: 'NaN' } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: 'Number.NaN' }),
      chromeCtx,
    );
    expect(result.output).toBe('NaN');
    expect(result.metadata).toMatchObject({ resultType: 'number', unserializableValue: 'NaN' });
  });

  it('evaluate reports JS exceptions', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ exceptionDetails: { text: 'ReferenceError: x is not defined' } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: 'x' }),
      chromeCtx,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('ReferenceError');
    expect(result.metadata).toMatchObject({ expressionLength: 1 });
  });

  it('evaluate preserves expression length metadata when CDP evaluation throws', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => {
        throw new Error('runtime failed');
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: ' \nwindow.secretValue\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('runtime failed');
    expect(result.output).not.toContain('window.secretValue');
    expect(result.metadata).toMatchObject({ expressionLength: 18 });
  });

  it('get_content returns innerText of the selector', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: { found: true, text: 'Page body text' } } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', {}),
      chromeCtx,
    );
    expect(result.output).toBe('Page body text');
    expect(result.metadata).toMatchObject({ selector: 'body', found: true });
  });

  it('get_content escapes selector before Runtime.evaluate', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: { found: true, text: 'Quoted selector text' } } }),
    });
    __setCdpClientForTesting(client);
    const selector = 'main[data-title="hello"]';

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector }),
      chromeCtx,
    );

    expect(result.output).toBe('Quoted selector text');
    expect(client.calls[0]).toEqual({
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => { const element = document.querySelector(${JSON.stringify(selector)}); return element ? { found: true, text: element.innerText ?? "" } : { found: false, text: "" }; })()`,
        returnByValue: true,
      },
    });
  });

  it('get_content returns error when selector does not match', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: { found: false, text: '' } } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: '.missing' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Element not found: .missing');
    expect(result.metadata).toMatchObject({ selector: '.missing', found: false });
  });

  it('get_content keeps empty text for an existing selector', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: { found: true, text: '' } } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: '.empty' }),
      chromeCtx,
    );

    expect(result.isError).toBeFalsy();
    expect(result.output).toBe('');
    expect(result.metadata).toMatchObject({
      selector: '.empty',
      found: true,
      originalLength: 0,
    });
  });

  it('get_content rejects blank selector before Runtime.evaluate', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: 'ignored' } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: ' \n\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"selector" must be a non-empty string');
    expect(client.calls).toHaveLength(0);
  });

  it('get_content uses trimmed selector before Runtime.evaluate', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: { found: true, text: 'Trimmed selector text' } } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: ' \nmain.content\t ' }),
      chromeCtx,
    );

    expect(result.output).toBe('Trimmed selector text');
    expect(client.calls[0]).toEqual({
      method: 'Runtime.evaluate',
      params: {
        expression: '(() => { const element = document.querySelector("main.content"); return element ? { found: true, text: element.innerText ?? "" } : { found: false, text: "" }; })()',
        returnByValue: true,
      },
    });
  });

  it('get_content truncates very long text', async () => {
    const long = 'x'.repeat(12000);
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: { found: true, text: long } } }),
    });
    __setCdpClientForTesting(client);
    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', {}),
      chromeCtx,
    );
    expect(result.output).toContain('truncated');
    expect(result.output.length).toBeLessThan(12000);
    expect(result.metadata).toMatchObject({
      selector: 'body',
      found: true,
      truncated: true,
      originalLength: 12000,
    });
  });

  it('returns error when CDP send throws (no Chrome running)', async () => {
    const client = {
      calls: [] as any[],
      async send() { throw new Error('WebSocket connection failed'); },
    };
    __setCdpClientForTesting(client);
    const result = await new ChromeNavigateExecutor().execute(
      makeChromeCall('chrome_navigate', { url: 'https://x.com' }),
      chromeCtx,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('WebSocket connection failed');
  });

});
