import { beforeEach, describe, expect, it } from 'vitest';
import {
  ChromeEvaluateExecutor,
  ChromeGetContentExecutor,
  __setCdpClientForTesting,
} from '../src/tool/builtins/chrome';
import { chromeCtx, makeChromeCall, mockCdpClient } from './chrome-cdp-test-utils';

describe('Chrome CDP runtime result handling', () => {
  beforeEach(() => {
    __setCdpClientForTesting(null);
  });

  it('preserves non-Error evaluate failure messages', async () => {
    const expression = ' location.href ';
    const client = mockCdpClient({
      'Runtime.evaluate': () => {
        throw 'runtime evaluate unavailable as string';
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('runtime evaluate unavailable as string');
    expect(result.output).not.toContain('undefined');
    expect(result.metadata).toMatchObject({
      expressionLength: expression.trim().length,
    });
  });

  it('rejects unstringifiable evaluate result values before returning success', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({
        result: { type: 'function', value: (() => 'bad') as any },
      }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: 'window.handler' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid evaluate result');
    expect(result.output).not.toBeUndefined();
    expect(result.metadata).toMatchObject({
      resultType: 'function',
    });
  });

  it('rejects missing evaluate result objects before returning success', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({}),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: 'window.value' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid evaluate result');
    expect(result.output).not.toBe('null');
    expect(result.metadata).toMatchObject({
      resultType: 'unknown',
    });
  });

  it('rejects typed evaluate result objects without values before returning success', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({
        result: { type: 'object' },
      }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: 'window.unserializableObject' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid evaluate result');
    expect(result.output).not.toBe('null');
    expect(result.metadata).toMatchObject({
      resultType: 'object',
    });
  });

  it('normalizes non-string evaluate JS exception text', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({
        exceptionDetails: { text: { bad: true } },
      }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeEvaluateExecutor().execute(
      makeChromeCall('chrome_evaluate', { expression: 'window.bad' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('JS error: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      expressionLength: 'window.bad'.length,
    });
  });

  it('reports get_content Runtime.evaluate exceptions', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({
        exceptionDetails: { text: 'SyntaxError: invalid selector' },
      }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: '[' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('SyntaxError: invalid selector');
    expect(result.metadata).toMatchObject({
      selector: '[',
    });
    expect(client.calls[0]).toEqual({
      method: 'Runtime.evaluate',
      params: {
        expression: '(() => { const element = document.querySelector("["); return element ? { found: true, text: element.innerText ?? "" } : { found: false, text: "" }; })()',
        returnByValue: true,
      },
    });
  });

  it('normalizes non-string get_content JS exception text', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({
        exceptionDetails: { text: { bad: true } },
      }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: 'main' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('JS error: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      selector: 'main',
    });
  });

  it('preserves non-Error get_content failure messages', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => {
        throw 'runtime content unavailable as string';
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: ' \narticle.main\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('runtime content unavailable as string');
    expect(result.output).not.toContain('undefined');
    expect(result.metadata).toMatchObject({
      selector: 'article.main',
    });
  });

  it('rejects malformed get_content text results before returning success', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({
        result: { value: { found: true, text: { bad: true } } },
      }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: 'main' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid text result');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      selector: 'main',
      found: true,
    });
  });

  it('rejects malformed get_content bridge results before reporting missing elements', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => ({
        result: { value: { found: 'yes', text: 'hello' } },
      }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: 'main' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid content result');
    expect(result.output).not.toContain('Element not found');
    expect(result.metadata).toMatchObject({
      selector: 'main',
    });
  });

  it('preserves selector metadata when get_content Runtime.evaluate throws', async () => {
    const client = mockCdpClient({
      'Runtime.evaluate': () => {
        throw new Error('runtime unavailable');
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeGetContentExecutor().execute(
      makeChromeCall('chrome_get_content', { selector: ' \nmain.content\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('runtime unavailable');
    expect(result.metadata).toMatchObject({
      selector: 'main.content',
    });
  });
});
