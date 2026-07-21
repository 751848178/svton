import { beforeEach, describe, expect, it } from 'vitest';
import {
  ChromeNavigateExecutor,
  ChromeScreenshotExecutor,
  __setCdpClientForTesting,
} from '../src/tool/builtins/chrome';
import { chromeCtx, makeChromeCall, mockCdpClient } from './chrome-cdp-test-utils';

describe('Chrome CDP page result handling', () => {
  beforeEach(() => {
    __setCdpClientForTesting(null);
  });

  it('rejects malformed navigate errorText before returning success', async () => {
    const client = mockCdpClient({
      'Page.navigate': () => ({ errorText: { bad: true } }),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeNavigateExecutor().execute(
      makeChromeCall('chrome_navigate', { url: ' https://example.com ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid navigation result');
    expect(result.output).not.toContain('Navigated to');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      url: 'https://example.com',
    });
  });

  it('rejects missing navigate results before returning success', async () => {
    const client = mockCdpClient({
      'Page.navigate': () => undefined,
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeNavigateExecutor().execute(
      makeChromeCall('chrome_navigate', { url: ' https://example.com ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid navigation result');
    expect(result.output).not.toContain('Navigated to');
    expect(result.metadata).toMatchObject({
      url: 'https://example.com',
    });
  });

  it('normalizes non-Error navigate CDP failures', async () => {
    const client = mockCdpClient({
      'Page.navigate': () => {
        throw { code: 'page_down' };
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeNavigateExecutor().execute(
      makeChromeCall('chrome_navigate', { url: ' https://example.com ' }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Chrome navigate failed: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      url: 'https://example.com',
    });
  });

  it('rejects screenshot results without image data', async () => {
    const client = mockCdpClient({
      'Page.captureScreenshot': () => ({}),
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeScreenshotExecutor().execute(
      makeChromeCall('chrome_screenshot', { fullPage: true }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('did not return image data');
    expect(result.metadata).toMatchObject({
      fullPage: true,
      mimeType: 'image/png',
      dataLength: 0,
    });
    expect(client.calls[0]).toEqual({
      method: 'Page.captureScreenshot',
      params: {
        format: 'png',
        captureBeyondViewport: true,
      },
    });
  });

  it('rejects missing screenshot results without leaking property access errors', async () => {
    const client = mockCdpClient({
      'Page.captureScreenshot': () => undefined,
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeScreenshotExecutor().execute(
      makeChromeCall('chrome_screenshot', { fullPage: true }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('did not return image data');
    expect(result.output).not.toContain('Cannot read properties');
    expect(result.metadata).toMatchObject({
      fullPage: true,
      mimeType: 'image/png',
      dataLength: 0,
    });
  });

  it('preserves screenshot metadata when CDP capture throws', async () => {
    const client = mockCdpClient({
      'Page.captureScreenshot': () => {
        throw new Error('capture failed');
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeScreenshotExecutor().execute(
      makeChromeCall('chrome_screenshot', { fullPage: true }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('capture failed');
    expect(result.metadata).toMatchObject({
      fullPage: true,
      mimeType: 'image/png',
      dataLength: 0,
    });
  });

  it('preserves non-Error screenshot capture failure messages', async () => {
    const client = mockCdpClient({
      'Page.captureScreenshot': () => {
        throw 'capture failed as string';
      },
    });
    __setCdpClientForTesting(client);

    const result = await new ChromeScreenshotExecutor().execute(
      makeChromeCall('chrome_screenshot', { fullPage: false }),
      chromeCtx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('capture failed as string');
    expect(result.output).not.toContain('undefined');
    expect(result.metadata).toMatchObject({
      fullPage: false,
      mimeType: 'image/png',
      dataLength: 0,
    });
  });
});
