import type { IHttpResponse } from '@svton/agent-platform';
import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import {
  formatWebFetchOutput,
  isTextualWebFetchContentType,
  normalizeWebFetchUrl,
  validateWebFetchFormat,
  webFetchRequestMetadata,
} from './web-fetch.utils';
import { formatUnknownErrorMessage } from './error-message.utils';
import { resolveHttp } from './web-http.utils';

const MAX_FETCH_OUTPUT_LENGTH = 50000;

export const webFetchDef: ToolDefinition = {
  name: 'web_fetch',
  description: 'Fetch and return the content of a URL. Returns the response body as text.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch.',
      },
      format: {
        type: 'string',
        enum: ['text', 'markdown'],
        description: 'Response format. Default: text.',
      },
    },
    required: ['url'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  } satisfies ToolAnnotations,
};

export class WebFetchExecutor implements IToolExecutor {
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { url, format } = call.arguments as { url?: string; format?: string };

    if (!url || typeof url !== 'string') {
      return { callId: call.id, output: 'Error: "url" is required and must be a string.', isError: true };
    }
    const resolvedFormat = typeof format === 'string'
      ? format.trim() || undefined
      : format;
    const formatError = validateWebFetchFormat(resolvedFormat);
    if (formatError) {
      return { callId: call.id, output: formatError, isError: true };
    }
    const normalizedUrl = normalizeWebFetchUrl(url);
    if (normalizedUrl.error || !normalizedUrl.url) {
      return { callId: call.id, output: normalizedUrl.error ?? 'Error: "url" is invalid.', isError: true };
    }

    const http = resolveHttp(ctx);
    try {
      const response = await http.request(normalizedUrl.url, { timeoutMs: 30000, signal: ctx.signal });
      const contentType = response.header('content-type') || '';

      if (!response.ok) {
        return {
          callId: call.id,
          output: `HTTP ${response.status}: ${response.statusText}`,
          isError: true,
          metadata: {
            ...webFetchRequestMetadata(normalizedUrl.url, resolvedFormat),
            contentType,
            status: response.status,
            statusText: response.statusText,
          },
        };
      }

      const normalizedContentType = contentType.toLowerCase();
      let output = await readFetchOutput(response, contentType, normalizedContentType, resolvedFormat);
      const originalLength = output.length;
      let truncated = false;

      if (output.length > MAX_FETCH_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_FETCH_OUTPUT_LENGTH) + '\n\n... (truncated)';
        truncated = true;
      }

      return {
        callId: call.id,
        output,
        metadata: {
          ...webFetchRequestMetadata(normalizedUrl.url, resolvedFormat),
          contentType,
          status: response.status,
          truncated,
          originalLength,
          outputLength: output.length,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Fetch error: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: webFetchRequestMetadata(normalizedUrl.url, resolvedFormat),
      };
    }
  }
}

async function readFetchOutput(
  response: IHttpResponse,
  contentType: string,
  normalizedContentType: string,
  format?: string,
): Promise<string> {
  if (isTextualWebFetchContentType(normalizedContentType)) {
    const text = await response.text();
    if (typeof text !== 'string') {
      throw new Error('HTTP response text() returned non-string body.');
    }
    return formatWebFetchOutput(text, normalizedContentType, format);
  }
  return `Binary content (${contentType}), ${response.header('content-length') || 'unknown'} bytes`;
}
