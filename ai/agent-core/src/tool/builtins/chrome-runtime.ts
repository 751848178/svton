/**
 * Chrome runtime evaluation and content extraction tools.
 */

import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { getCdpClient } from './chrome-cdp-client';
import { formatChromeErrorMessage } from './chrome-error.utils';
import {
  buildGetContentExpression,
  formatEvaluateResult,
  formatGetContentResult,
  formatRuntimeExceptionText,
} from './chrome-runtime-result.utils';

export const chromeEvaluateDef: ToolDefinition = {
  name: 'chrome_evaluate',
  description: 'Execute JavaScript in the Chrome page and return the result.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'JavaScript expression to evaluate' },
    },
    required: ['expression'],
  },
  annotations: { destructiveHint: true, openWorldHint: true },
};

export class ChromeEvaluateExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { expression } = call.arguments as any;
    if (typeof expression !== 'string' || expression.trim().length === 0) {
      return {
        callId: call.id,
        output: 'Error: "expression" is required and must be a string.',
        isError: true,
      };
    }
    const resolvedExpression = expression.trim();

    try {
      const client = getCdpClient();
      const result = await client.send('Runtime.evaluate', {
        expression: resolvedExpression,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        return {
          callId: call.id,
          output: `JS error: ${formatRuntimeExceptionText(result.exceptionDetails)}`,
          isError: true,
          metadata: {
            expressionLength: resolvedExpression.length,
          },
        };
      }
      const formatted = formatEvaluateResult(result.result);
      return {
        callId: call.id,
        output: formatted.output,
        ...(formatted.isError ? { isError: true } : {}),
        metadata: {
          resultType: formatted.resultType,
          ...(formatted.unserializableValue ? { unserializableValue: formatted.unserializableValue } : {}),
        },
      };
    } catch (err: unknown) {
      return {
        callId: call.id,
        output: `Chrome evaluate failed: ${formatChromeErrorMessage(err)}`,
        isError: true,
        metadata: {
          expressionLength: resolvedExpression.length,
        },
      };
    }
  }
}

export const chromeGetContentDef: ToolDefinition = {
  name: 'chrome_get_content',
  description: 'Get the text content of the current Chrome page.',
  parameters: {
    type: 'object',
    properties: {
      selector: { type: 'string', description: 'CSS selector (default: "body")' },
    },
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

export class ChromeGetContentExecutor implements IToolExecutor {
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { selector = 'body' } = call.arguments as any;
    if (typeof selector !== 'string') {
      return {
        callId: call.id,
        output: 'Error: "selector" must be a string.',
        isError: true,
      };
    }
    const resolvedSelector = selector.trim();
    if (resolvedSelector.length === 0) {
      return {
        callId: call.id,
        output: 'Error: "selector" must be a non-empty string.',
        isError: true,
      };
    }

    try {
      const client = getCdpClient();
      const result = await client.send('Runtime.evaluate', {
        expression: buildGetContentExpression(resolvedSelector),
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        return {
          callId: call.id,
          output: `JS error: ${formatRuntimeExceptionText(result.exceptionDetails)}`,
          isError: true,
          metadata: {
            selector: resolvedSelector,
          },
        };
      }
      const formatted = formatGetContentResult(result.result?.value, resolvedSelector);
      return {
        callId: call.id,
        output: formatted.output,
        ...(formatted.isError ? { isError: true } : {}),
        metadata: formatted.metadata,
      };
    } catch (err: unknown) {
      return {
        callId: call.id,
        output: `Chrome get content failed: ${formatChromeErrorMessage(err)}`,
        isError: true,
        metadata: {
          selector: resolvedSelector,
        },
      };
    }
  }
}
