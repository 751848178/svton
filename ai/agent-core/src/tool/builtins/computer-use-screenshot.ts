import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatComputerUseErrorMessage } from './computer-use-error.utils';
import { computerInvoke } from './computer-use-invoke';
import { validateDisplayIndex } from './computer-use-validation.utils';

const SCREENSHOT_MIME_TYPE = 'image/png';

export const screenshotDef: ToolDefinition = {
  name: 'screenshot',
  description:
    'Capture a screenshot of the current display. Returns a base64-encoded PNG image. Use this to see what is on the screen before interacting with it.',
  parameters: {
    type: 'object',
    properties: {
      display: {
        type: 'number',
        description: 'Display index (0 = primary). Defaults to 0.',
      },
    },
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
};

export class ScreenshotExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const displayIndex = (call.arguments as any).display ?? 0;
    const displayError = validateDisplayIndex(displayIndex);
    if (displayError) {
      return { callId: call.id, output: displayError, isError: true };
    }

    try {
      const base64 = await computerInvoke<string>(ctx, 'screenshot_display', { displayIndex });
      if (typeof base64 !== 'string') {
        return {
          callId: call.id,
          output: 'Screenshot failed: backend returned non-string image data.',
          isError: true,
          metadata: {
            displayIndex,
            mimeType: SCREENSHOT_MIME_TYPE,
            dataLength: 0,
          },
        };
      }
      if (base64.length === 0) {
        return {
          callId: call.id,
          output: 'Screenshot failed: backend returned empty image data.',
          isError: true,
          metadata: {
            displayIndex,
            mimeType: SCREENSHOT_MIME_TYPE,
            dataLength: 0,
          },
        };
      }
      return {
        callId: call.id,
        output: JSON.stringify({
          type: 'image',
          data: base64,
          mimeType: SCREENSHOT_MIME_TYPE,
        }),
        metadata: {
          displayIndex,
          mimeType: SCREENSHOT_MIME_TYPE,
          dataLength: base64.length,
        },
      };
    } catch (err: unknown) {
      return {
        callId: call.id,
        output: `Screenshot failed: ${formatComputerUseErrorMessage(err)}`,
        isError: true,
        metadata: {
          displayIndex,
          mimeType: SCREENSHOT_MIME_TYPE,
          dataLength: 0,
        },
      };
    }
  }
}
