import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';

// ============================================================
// web_search (placeholder - depends on external search API)
// ============================================================

export const webSearchDef: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for information. Returns search results with titles, URLs, and snippets.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query.',
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results. Default: 10.',
      },
    },
    required: ['query'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  } satisfies ToolAnnotations,
};

export class WebSearchExecutor implements IToolExecutor {
  constructor(private readonly searchEndpoint?: string) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { query } = call.arguments as { query?: string };

    if (!query || typeof query !== 'string') {
      return { callId: call.id, output: 'Error: "query" is required and must be a string.', isError: true };
    }

    if (!this.searchEndpoint) {
      return {
        callId: call.id,
        output: 'Web search is not configured. Please provide a search endpoint.',
        isError: true,
      };
    }

    try {
      const response = await fetch(`${this.searchEndpoint}?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`Search API returned ${response.status}`);
      }
      const data = await response.json();
      return {
        callId: call.id,
        output: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Search error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

// ============================================================
// web_fetch
// ============================================================

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
  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { url } = call.arguments as { url?: string; format?: string };

    if (!url || typeof url !== 'string') {
      return { callId: call.id, output: 'Error: "url" is required and must be a string.', isError: true };
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return {
          callId: call.id,
          output: `HTTP ${response.status}: ${response.statusText}`,
          isError: true,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      let output: string;

      if (contentType.includes('text/') || contentType.includes('json') || contentType.includes('xml')) {
        output = await response.text();
      } else {
        output = `Binary content (${contentType}), ${response.headers.get('content-length') || 'unknown'} bytes`;
      }

      // Truncate very large responses
      const MAX_LENGTH = 50000;
      if (output.length > MAX_LENGTH) {
        output = output.slice(0, MAX_LENGTH) + '\n\n... (truncated)';
      }

      return {
        callId: call.id,
        output,
        metadata: {
          url,
          contentType,
          status: response.status,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Fetch error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
