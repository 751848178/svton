import { beforeEach, describe, expect, it } from 'vitest';
import {
  ChromeClickExecutor,
  ChromeEvaluateExecutor,
  ChromeGetContentExecutor,
  ChromeNavigateExecutor,
  ChromeTypeExecutor,
  __setCdpClientForTesting,
} from '../src/tool/builtins/chrome';
import { chromeCtx, makeChromeCall, mockCdpClient } from './chrome-cdp-test-utils';

describe('Chrome CDP argument validation', () => {
  beforeEach(() => {
    __setCdpClientForTesting(null);
  });

  it.each([
    ['chrome_navigate url', new ChromeNavigateExecutor(), 'chrome_navigate', { url: 123 }, '"url"'],
    ['chrome_click selector', new ChromeClickExecutor(), 'chrome_click', { selector: 123 }, '"selector"'],
    ['chrome_type text', new ChromeTypeExecutor(), 'chrome_type', { text: 123 }, '"text"'],
    ['chrome_evaluate expression', new ChromeEvaluateExecutor(), 'chrome_evaluate', { expression: 123 }, '"expression"'],
    ['chrome_get_content selector', new ChromeGetContentExecutor(), 'chrome_get_content', { selector: 123 }, '"selector"'],
  ])('rejects invalid %s before CDP call', async (_label, executor, name, args, message) => {
    const client = mockCdpClient();
    __setCdpClientForTesting(client);

    const result = await executor.execute(makeChromeCall(name, args), chromeCtx);

    expect(result.isError).toBe(true);
    expect(result.output).toContain(message);
    expect(result.output).toContain('must be a string');
    expect(client.calls).toHaveLength(0);
  });

  it('rejects blank evaluate expression before Runtime.evaluate', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: 'ignored' } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: ' \n\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"expression" is required and must be a string');
    expect(client.calls).toHaveLength(0);
  });

  it('uses trimmed evaluate expression for Runtime.evaluate', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({ result: { value: 42 } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: ' \n6 * 7\t ' }),
      chromeCtx,
    );

    expect(result.output).toBe('42');
    expect(client.calls[0]).toEqual({
      method: 'Runtime.evaluate',
      params: {
        expression: '6 * 7',
        returnByValue: true,
      },
    });
  });
});
