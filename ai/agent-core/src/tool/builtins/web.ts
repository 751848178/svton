import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';

// ============================================================
// web_search
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

/**
 * Search backend configuration.
 *
 * - `tavily` (recommended): hosted AI-optimised search, only needs an API key.
 *   Sign up at https://tavily.com for a free key. Calls POST /search with
 *   Bearer auth.
 * - `custom`: self-hosted search endpoint (e.g. SearXNG). Accepts GET ?q=
 *   and returns JSON results.
 */
export type WebSearchProvider = 'tavily' | 'custom';

export interface WebSearchConfig {
  provider: WebSearchProvider;
  /** Required for `tavily` (tvly-...) */
  apiKey?: string;
  /** Required for `custom` (e.g. https://my-searxng/search) */
  endpoint?: string;
}

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

/**
 * Map raw API result items to the {title, url, snippet} shape the UI expects.
 * Covers both Tavily (uses `content`) and SearXNG (uses `snippet`/`description`).
 */
function normalizeSearchResult(r: any): { title: string; url: string; snippet: string } {
  return {
    title: r.title || r.name || 'Untitled',
    url: r.url || r.link || r.href || '#',
    snippet: r.snippet || r.content || r.description || r.summary || '',
  };
}

/**
 * Extract an array of results from various search-API response shapes.
 */
function extractResults(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export class WebSearchExecutor implements IToolExecutor {
  private readonly config: WebSearchConfig | null;

  /**
   * Accepts either:
   *  - a config object ({provider, apiKey?, endpoint?})
   *  - a legacy endpoint string (treated as {provider: 'custom', endpoint})
   *  - undefined/null (no backend → execute() returns "not configured")
   *
   * The legacy string form is kept for backward compatibility with callers
   * that haven't migrated to the config object.
   */
  constructor(config?: WebSearchConfig | string | null) {
    if (typeof config === 'string') {
      this.config = config ? { provider: 'custom', endpoint: config } : null;
    } else if (config && (config.apiKey || config.endpoint)) {
      this.config = config;
    } else {
      this.config = null;
    }
  }

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { query } = call.arguments as { query?: string };

    if (!query || typeof query !== 'string') {
      return { callId: call.id, output: 'Error: "query" is required and must be a string.', isError: true };
    }

    if (!this.config) {
      return {
        callId: call.id,
        output: 'Web search is not configured. Set a Tavily API key or a custom search endpoint in Settings.',
        isError: true,
      };
    }

    try {
      const { response, data } = this.config.provider === 'tavily'
        ? await this.searchTavily(query)
        : await this.searchCustom(query);

      if (!response.ok) {
        throw new Error(`Search API returned ${response.status}`);
      }

      const results = extractResults(data);
      const searchResults = results.slice(0, 10).map(normalizeSearchResult);

      return {
        callId: call.id,
        output: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        metadata: { searchResults, query },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Search error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  /** Tavily: POST /search with Bearer auth. */
  private async searchTavily(query: string): Promise<{ response: Response; data: any }> {
    const apiKey = this.config?.apiKey;
    if (!apiKey) throw new Error('Tavily API key is not configured');

    const response = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: 10,
        search_depth: 'basic',
      }),
    });

    let data: any = null;
    try {
      data = response.ok ? await response.json() : null;
    } catch {
      data = null;
    }
    return { response, data };
  }

  /** Custom endpoint (SearXNG): GET ?q=. */
  private async searchCustom(query: string): Promise<{ response: Response; data: any }> {
    const endpoint = this.config?.endpoint;
    if (!endpoint) throw new Error('Custom search endpoint is not configured');

    const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
    const data = response.ok ? await response.json() : null;
    return { response, data };
  }
}

/**
 * Build a WebSearchExecutor from a stored config + legacy endpoint, or return
 * null when no backend is configured (caller should skip tool registration).
 *
 * @param config  Value of the `searchConfig` storage key (new schema).
 * @param legacyEndpoint  Value of the legacy `searchEndpoint` storage key.
 *                        Used as a fallback when `config` is absent (preserves
 *                        existing SearXNG setups).
 */
export function createWebSearchExecutor(
  config?: WebSearchConfig | null,
  legacyEndpoint?: string | null,
): WebSearchExecutor | null {
  if (config && (config.apiKey || config.endpoint)) {
    return new WebSearchExecutor(config);
  }
  if (legacyEndpoint) {
    return new WebSearchExecutor(legacyEndpoint);
  }
  return null;
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
