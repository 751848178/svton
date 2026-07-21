/**
 * Document preview tool.
 *
 * Calls the platform's IDocumentPreview to render PDF, Excel, or PPTX files
 * into images/structured data that the UI can display.
 */

import type { ToolDefinition, ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatUnknownErrorMessage } from './error-message.utils';

const DOCUMENT_TYPES = ['pdf', 'excel', 'pptx'] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

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
        enum: [...DOCUMENT_TYPES],
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
    const args = call.arguments as { path?: string; type?: string };
    const path = typeof args.path === 'string' ? args.path.trim() : args.path;
    const requestedType = typeof args.type === 'string' ? args.type.trim() : args.type;
    if (!path || typeof path !== 'string') {
      return {
        callId: call.id,
        output: 'Error: "path" is required and must be a string.',
        isError: true,
      };
    }
    if (!requestedType || !DOCUMENT_TYPES.includes(requestedType as DocumentType)) {
      return {
        callId: call.id,
        output: `Error: "type" must be one of: ${DOCUMENT_TYPES.join(', ')}.`,
        isError: true,
      };
    }

    const type = requestedType as DocumentType;
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
      if (type === 'pdf') {
        result = await preview.previewPdf(path);
      } else if (type === 'excel') {
        result = await preview.previewExcel(path);
      } else {
        result = await preview.previewPptx(path);
      }

      const metadata: Record<string, unknown> = {
        path,
        documentType: type,
        resultKind: result.kind,
        previewResult: result,
      };

      if (result.kind === 'images') {
        if (!hasUsablePreviewImages(result.images)) {
          return previewResultError(call, 'Preview failed: provider returned no usable image data.', {
            path,
            documentType: type,
            resultKind: 'images',
            imageCount: 0,
          });
        }
        metadata.imageCount = result.images.length;
        return {
          callId: call.id,
          output: JSON.stringify({ kind: 'images', count: result.images.length, type }),
          metadata,
        };
      } else if (result.kind === 'structured') {
        const output = JSON.stringify(result.data);
        if (typeof output !== 'string') {
          return previewResultError(call, 'Preview failed: provider returned unserializable structured data.', {
            path,
            documentType: type,
            resultKind: 'structured',
          });
        }
        return {
          callId: call.id,
          output,
          metadata,
        };
      } else if (result.kind === 'text') {
        if (typeof result.text !== 'string') {
          return previewResultError(call, 'Preview failed: provider returned non-string text data.', {
            path,
            documentType: type,
            resultKind: 'text',
          });
        }
        return {
          callId: call.id,
          output: result.text,
          metadata,
        };
      }
      return previewResultError(call, 'Preview failed: provider returned an unknown preview result kind.', {
        path,
        documentType: type,
        resultKind: typeof result.kind === 'string' ? result.kind : null,
      });
    } catch (err) {
      return {
        callId: call.id,
        output: `Preview failed: ${formatUnknownErrorMessage(err)}`,
        isError: true,
        metadata: {
          path,
          documentType: type,
        },
      };
    }
  }
}

function hasUsablePreviewImages(images: unknown): images is string[] {
  return Array.isArray(images) &&
    images.length > 0 &&
    images.every((image) => typeof image === 'string' && image.trim().length > 0);
}

function previewResultError(
  call: ToolCall,
  output: string,
  metadata: Record<string, unknown>,
): ToolResult {
  return {
    callId: call.id,
    output,
    isError: true,
    metadata,
  };
}
