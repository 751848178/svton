import { beforeEach, describe, expect, it } from 'vitest';
import {
  ChromeClickExecutor,
  __setCdpClientForTesting,
} from '../src/tool/builtins/chrome';
import { chromeCtx, makeChromeCall, mockCdpClient } from './chrome-cdp-test-utils';

describe('Chrome CDP interaction result handling', () => {
  beforeEach(() => {
    __setCdpClientForTesting(null);
  });

  it('rejects click box models without finite content coordinates', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': () => ({ nodeId: 42 }),
      'DOM.getBoxModel': () => ({ model: { content: [0, 0, 100, 0] } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: '#broken' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('valid box model');
    expect(result.metadata).toMatchObject({
      selector: '#broken',
    });
    expect(client.calls.some((call) => call.method === 'Input.dispatchMouseEvent')).toBe(false);
  });

  it('rejects missing click box models without leaking property access errors', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': () => ({ nodeId: 42 }),
      'DOM.getBoxModel': () => ({}),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: '#broken' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('valid box model');
    expect(result.output).not.toContain('Cannot read properties');
    expect(result.metadata).toMatchObject({
      selector: '#broken',
    });
    expect(client.calls.some((call) => call.method === 'Input.dispatchMouseEvent')).toBe(false);
  });

  it('rejects malformed click document results before querying selectors', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({}),
      'DOM.querySelector': () => ({ nodeId: 42 }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: ' #submit ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid document result');
    expect(result.output).not.toContain('Cannot read properties');
    expect(result.metadata).toMatchObject({
      selector: '#submit',
    });
    expect(client.calls.some((call) => call.method === 'DOM.querySelector')).toBe(false);
  });

  it('rejects malformed click selector node IDs before reading box models', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => ({ root: { nodeId: 1 } }),
      'DOM.querySelector': () => ({ nodeId: '42' }),
      'DOM.getBoxModel': () => ({ model: { content: [0, 0, 100, 0, 100, 20, 0, 20] } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: ' #submit ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid selector result');
    expect(result.output).not.toContain('Clicked element');
    expect(result.metadata).toMatchObject({
      selector: '#submit',
    });
    expect(client.calls.some((call) => call.method === 'DOM.getBoxModel')).toBe(false);
    expect(client.calls.some((call) => call.method === 'Input.dispatchMouseEvent')).toBe(false);
  });

  it('preserves selector metadata when click CDP lookup throws', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => {
        throw new Error('dom unavailable');
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: ' \n#submit\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('dom unavailable');
    expect(result.metadata).toMatchObject({
      selector: '#submit',
    });
  });

  it('normalizes non-Error click CDP lookup failures', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => {
        throw { code: 'dom_down' };
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: ' \n#submit\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Chrome click failed: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      selector: '#submit',
    });
  });

  it('preserves non-Error click lookup failure messages', async () => {
    const client = mockCdpClient({
      'DOM.getDocument': () => {
        throw 'dom unavailable as string';
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeClickExecutor().execute(
      makeChromeCall('chrome_click', { selector: ' \n#submit\t ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('dom unavailable as string');
    expect(result.output).not.toContain('undefined');
    expect(result.metadata).toMatchObject({
      selector: '#submit',
    });
  });
});
