/**
 * Chrome DOM interaction tools.
 */

import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { getCdpClient } from './chrome-cdp-client';
import { formatChromeErrorMessage } from './chrome-error.utils';

export const chromeClickDef: ToolDefinition = {
  name: 'chrome_click',
  description: 'Click an element in Chrome by CSS selector. Uses CDP DOM.dispatchEvent.',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector of the element to click' },
    },
    required: ['selector'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class ChromeClickExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { selector } = call.arguments as any;
    if (typeof selector !== 'string' || selector.trim().length === 0) {
      return {
        callId: call.id,
        output: 'Error: "selector" is required and must be a string.',
        isError: true,
      };
    }
    const resolvedSelector = selector.trim();

    try {
      const client = getCdpClient();

      const doc = await client.send('DOM.getDocument');
      const rootNodeId = doc?.root?.nodeId;
      if (!Number.isInteger(rootNodeId) || rootNodeId <= 0) {
        return {
          callId: call.id,
          output: 'Chrome click failed: DOM.getDocument returned invalid document result.',
          isError: true,
          metadata: {
            selector: resolvedSelector,
          },
        };
      }
      const node = await client.send('DOM.querySelector', {
        nodeId: rootNodeId,
        selector: resolvedSelector,
      });
      const targetNodeId = node?.nodeId;
      if (targetNodeId === 0) {
        return {
          callId: call.id,
          output: `Element not found: ${resolvedSelector}`,
          isError: true,
          metadata: {
            selector: resolvedSelector,
          },
        };
      }
      if (!Number.isInteger(targetNodeId) || targetNodeId <= 0) {
        return {
          callId: call.id,
          output: `Chrome click failed: DOM.querySelector returned invalid selector result for "${resolvedSelector}".`,
          isError: true,
          metadata: {
            selector: resolvedSelector,
          },
        };
      }

      const box = await client.send('DOM.getBoxModel', { nodeId: targetNodeId });
      const content = box?.model?.content;
      if (
        !Array.isArray(content) ||
        content.length < 8 ||
        content.some((value) => typeof value !== 'number' || !Number.isFinite(value))
      ) {
        return {
          callId: call.id,
          output: `Chrome click failed: element "${resolvedSelector}" did not return a valid box model.`,
          isError: true,
          metadata: {
            selector: resolvedSelector,
          },
        };
      }
      const x = (content[0] + content[2] + content[4] + content[6]) / 4;
      const y = (content[1] + content[3] + content[5] + content[7]) / 4;

      await client.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1,
      });
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1,
      });

      return {
        callId: call.id,
        output: `Clicked element "${resolvedSelector}" at (${Math.round(x)}, ${Math.round(y)})`,
        metadata: {
          selector: resolvedSelector,
          x,
          y,
          button: 'left',
        },
      };
    } catch (err: unknown) {
      return {
        callId: call.id,
        output: `Chrome click failed: ${formatChromeErrorMessage(err)}`,
        isError: true,
        metadata: {
          selector: resolvedSelector,
        },
      };
    }
  }
}

export const chromeTypeDef: ToolDefinition = {
  name: 'chrome_type',
  description: 'Type text into the currently focused element in Chrome.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to type' },
    },
    required: ['text'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class ChromeTypeExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { text } = call.arguments as any;
    if (!text || typeof text !== 'string') {
      return {
        callId: call.id,
        output: 'Error: "text" is required and must be a string.',
        isError: true,
      };
    }

    try {
      const client = getCdpClient();
      await client.send('Input.insertText', { text });
      return {
        callId: call.id,
        output: `Typed ${text.length} characters into Chrome.`,
        metadata: { textLength: text.length },
      };
    } catch (err: unknown) {
      return {
        callId: call.id,
        output: `Chrome type failed: ${formatChromeErrorMessage(err)}`,
        isError: true,
        metadata: { textLength: text.length },
      };
    }
  }
}
