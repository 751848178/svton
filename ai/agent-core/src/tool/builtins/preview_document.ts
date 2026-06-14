/**
 * Document preview tool.
 *
 * Calls the platform's IDocumentPreview to render PDF, Excel, or PPTX files
 * into images/structured data that the UI can display.
 */

import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';

export const previewDocumentDef: ToolDefinition = {
  name: 'preview_document',
  description:
    'Preview a document file (PDF, Excel, PowerPoint) by rendering it to images. ' +
    'Use this when the user wants to view or preview a document file. ' +
    'Returns base64-encoded page images.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the document file',
      },
      type: {
        type: 'string',
        enum: ['pdf', 'excel', 'pptx'],
        description: 'Document type for rendering',
      },
    },
    required: ['path', 'type'],
  },
  annotations: {
    readOnlyHint: true,
  },
};

export class PreviewDocumentExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const args = call.arguments as { path: string; type: string };
    const preview = ctx.platform.preview;

    if (!preview) {
      return {
        callId: call.id,
        output: 'Document preview is not available on this platform. Use the desktop app for file preview.',
        isError: true,
      };
    }

    try {
      let result;
      if (args.type === 'pdf') {
        result = await preview.previewPdf(args.path);
      } else if (args.type === 'excel') {
        result = await preview.previewExcel(args.path);
      } else if (args.type === 'pptx') {
        result = await preview.previewPptx(args.path);
      } else {
        return {
          callId: call.id,
          output: `Unknown document type: ${args.type}`,
          isError: true,
        };
      }

      const metadata: Record<string, unknown> = { previewResult: result };

      if (result.kind === 'images') {
        metadata.imageCount = result.images.length;
        return {
          callId: call.id,
          output: JSON.stringify({ kind: 'images', count: result.images.length, type: args.type }),
          metadata,
        };
      } else if (result.kind === 'structured') {
        return {
          callId: call.id,
          output: JSON.stringify(result.data),
          metadata,
        };
      } else {
        return {
          callId: call.id,
          output: result.text,
          metadata,
        };
      }
    } catch (err) {
      return {
        callId: call.id,
        output: `Preview failed: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  }
}
