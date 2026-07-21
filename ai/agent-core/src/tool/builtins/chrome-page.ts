/**
 * Chrome page navigation and screenshot tools.
 */

import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { getCdpClient } from './chrome-cdp-client';
import { formatChromeErrorMessage } from './chrome-error.utils';

const CHROME_SCREENSHOT_MIME_TYPE = 'image/png';

export const chromeNavigateDef: ToolDefinition = {
  name: 'chrome_navigate',
  description: 'Navigate Chrome to a URL. Requires Chrome running with --remote-debugging-port=9222.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
    },
    required: ['url'],
  },
  annotations: { destructiveHint: false, openWorldHint: true },
};

export class ChromeNavigateExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { url } = call.arguments as any;
    if (typeof url !== 'string' || url.trim().length === 0) {
      return {
        callId: call.id,
        output: 'Error: "url" is required and must be a string.',
        isError: true,
      };
    }
    const resolvedUrl = url.trim();

    try {
      const client = getCdpClient();
      const result = await client.send('Page.navigate', { url: resolvedUrl });
      if (result === null || typeof result !== 'object') {
        return {
          callId: call.id,
          output: 'Chrome navigate failed: Page.navigate returned invalid navigation result.',
          isError: true,
          metadata: {
            url: resolvedUrl,
          },
        };
      }
      const errorText = typeof result?.errorText === 'string' ? result.errorText.trim() : '';
      if (result?.errorText !== undefined && typeof result.errorText !== 'string') {
        return {
          callId: call.id,
          output: 'Chrome navigate failed: Page.navigate returned invalid navigation result.',
          isError: true,
          metadata: {
            url: resolvedUrl,
          },
        };
      }
      if (errorText.length > 0) {
        return {
          callId: call.id,
          output: `Chrome navigate failed for ${resolvedUrl}: ${errorText}`,
          isError: true,
          metadata: {
            url: resolvedUrl,
            errorText,
          },
        };
      }
      await new Promise((r) => setTimeout(r, 1000));
      return {
        callId: call.id,
        output: `Navigated to ${resolvedUrl}`,
        metadata: {
          url: resolvedUrl,
          ...(typeof result?.frameId === 'string' ? { frameId: result.frameId } : {}),
        },
      };
    } catch (err: any) {
      return {
        callId: call.id,
        output: `Chrome navigate failed: ${formatChromeErrorMessage(err)}`,
        isError: true,
        metadata: {
          url: resolvedUrl,
        },
      };
    }
  }
}

export const chromeScreenshotDef: ToolDefinition = {
  name: 'chrome_screenshot',
  description: 'Capture a screenshot of the current Chrome page. Returns base64 PNG.',
  parameters: {
    type: 'object',
    properties: {
      fullPage: { type: 'boolean', description: 'Capture full page (default: viewport only)' },
    },
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

export class ChromeScreenshotExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { fullPage } = call.arguments as any;
    if (fullPage !== undefined && typeof fullPage !== 'boolean') {
      return {
        callId: call.id,
        output: 'Error: "fullPage" must be a boolean.',
        isError: true,
      };
    }

    const resolvedFullPage = fullPage ?? false;
    try {
      const client = getCdpClient();
      const result = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: resolvedFullPage,
      });
      if (result === null || typeof result !== 'object' || typeof result.data !== 'string' || result.data.length === 0) {
        return {
          callId: call.id,
          output: 'Chrome screenshot failed: Page.captureScreenshot did not return image data.',
          isError: true,
          metadata: {
            fullPage: resolvedFullPage,
            mimeType: CHROME_SCREENSHOT_MIME_TYPE,
            dataLength: 0,
          },
        };
      }
      return {
        callId: call.id,
        output: JSON.stringify({ type: 'image', data: result.data, mimeType: CHROME_SCREENSHOT_MIME_TYPE }),
        metadata: {
          fullPage: resolvedFullPage,
          mimeType: CHROME_SCREENSHOT_MIME_TYPE,
          dataLength: result.data.length,
        },
      };
    } catch (err: any) {
      return {
        callId: call.id,
        output: `Chrome screenshot failed: ${formatChromeErrorMessage(err)}`,
        isError: true,
        metadata: {
          fullPage: resolvedFullPage,
          mimeType: CHROME_SCREENSHOT_MIME_TYPE,
          dataLength: 0,
        },
      };
    }
  }
}
