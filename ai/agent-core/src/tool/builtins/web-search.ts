import type { IHttpClient, IHttpResponse } from '@svton/agent-platform';
import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import { formatUnknownErrorMessage } from './error-message.utils';
import { resolveHttp } from './web-http.utils';
import {
  buildCustomSearchUrl,
  extractSearchResults,
  formatSearchResultsOutput,
  normalizeMaxResults,
  normalizeSearchQuery,
  normalizeSearchResult,
  webSearchRequestMetadata,
} from './web-search.utils';

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

export type WebSearchProvider = 'tavily' | 'custom';

export interface WebSearchConfig {
  provider: WebSearchProvider;
  apiKey?: string;
  endpoint?: string;
}

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

export class WebSearchExecutor implements IToolExecutor {
  private readonly config: WebSearchConfig | null;

  constructor(config?: WebSearchConfig | string | null) {
    if (typeof config === 'string') {
      this.config = config ? { provider: 'custom', endpoint: config } : null;
    } else if (config?.provider === 'tavily' || config?.provider === 'custom') {
      this.config = config;
    } else {
      this.config = null;
    }
  }

  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const { query, max_results } = call.arguments as { query?: string; max_results?: number };
    const normalizedQuery = normalizeSearchQuery(query);
    if (normalizedQuery.error || !normalizedQuery.query) {
      return { callId: call.id, output: normalizedQuery.error ?? 'Error: "query" is invalid.', isError: true };
    }
    let maxResults: number;
    try {
      maxResults = normalizeMaxResults(max_results);
    } catch (error) {
      return {
        callId: call.id,
        output: formatUnknownErrorMessage(error),
        isError: true,
      };
    }
    if (!this.config) {
      return {
        callId: call.id,
        output: 'Web search is not configured. Set a Tavily API key or a custom search endpoint in Settings.',
        isError: true,
        metadata: webSearchRequestMetadata(null, normalizedQuery.query, maxResults),
      };
    }

    const http = resolveHttp(ctx);
    try {
      const { response, data } = this.config.provider === 'tavily'
        ? await this.searchTavily(normalizedQuery.query, http, ctx.signal, maxResults)
        : await this.searchCustom(normalizedQuery.query, http, ctx.signal);

      if (!response.ok) {
        return {
          callId: call.id,
          output: `Search error: Search API returned ${response.status}`,
          isError: true,
          metadata: {
            ...webSearchRequestMetadata(this.config.provider, normalizedQuery.query, maxResults),
            status: response.status,
            statusText: response.statusText,
          },
        };
      }

      const results = extractSearchResults(data);
      const searchResults = results.slice(0, maxResults).map(normalizeSearchResult);

      return {
        callId: call.id,
        output: typeof data === 'string' ? data : formatSearchResultsOutput(searchResults),
        metadata: {
          ...webSearchRequestMetadata(this.config.provider, normalizedQuery.query, maxResults),
          searchResults,
          resultCount: searchResults.length,
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Search error: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: webSearchRequestMetadata(this.config.provider, normalizedQuery.query, maxResults),
      };
    }
  }

  private async searchTavily(
    query: string,
    http: IHttpClient,
    signal: AbortSignal | undefined,
    maxResults: number,
  ): Promise<{ response: IHttpResponse; data: any }> {
    const apiKey = this.config?.apiKey;
    if (!apiKey) throw new Error('Tavily API key is not configured');

    const response = await http.request(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
      signal,
    });

    const data = await readSearchJson(response, 'Tavily');
    return { response, data };
  }

  private async searchCustom(
    query: string,
    http: IHttpClient,
    signal?: AbortSignal,
  ): Promise<{ response: IHttpResponse; data: any }> {
    const endpoint = this.config?.endpoint;
    if (!endpoint) throw new Error('Custom search endpoint is not configured');

    const response = await http.request(buildCustomSearchUrl(endpoint, query), { signal });
    const data = await readSearchJson(response, 'Custom search');
    return { response, data };
  }
}

async function readSearchJson(response: IHttpResponse, providerName: string): Promise<any> {
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    throw new Error(`${providerName} response was not valid JSON.`);
  }
}

export function createWebSearchExecutor(
  config?: WebSearchConfig | null,
  legacyEndpoint?: string | null,
): WebSearchExecutor | null {
  if (config?.provider === 'tavily' || config?.provider === 'custom') {
    return new WebSearchExecutor(config);
  }
  if (legacyEndpoint) {
    return new WebSearchExecutor(legacyEndpoint);
  }
  return null;
}
