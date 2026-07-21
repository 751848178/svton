const DEFAULT_SEARCH_RESULTS = 10;
const MAX_SEARCH_RESULTS = 10;

export interface NormalizedSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export function webSearchRequestMetadata(
  provider: string | null,
  query: string,
  maxResults: number,
): { provider: string | null; query: string; maxResults: number } {
  return { provider, query, maxResults };
}

export function normalizeMaxResults(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_SEARCH_RESULTS;
  }
  if (typeof value !== 'number') {
    throw new Error('"max_results" must be a number.');
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error('"max_results" must be a positive integer.');
  }
  return Math.min(MAX_SEARCH_RESULTS, value);
}

export function normalizeSearchQuery(value: unknown): { query: string | null; error: string | null } {
  if (typeof value !== 'string') {
    return { query: null, error: 'Error: "query" is required and must be a string.' };
  }
  const query = value.trim();
  return query
    ? { query, error: null }
    : { query: null, error: 'Error: "query" is required and must be a string.' };
}

export function buildCustomSearchUrl(endpoint: string, query: string): string {
  const url = new URL(endpoint);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Custom search endpoint must use http:// or https://');
  }
  url.searchParams.set('q', query);
  return url.toString();
}

export function normalizeSearchResult(r: any): NormalizedSearchResult {
  return {
    title: firstNonEmptyString(r.title, r.name) ?? 'Untitled',
    url: firstNonEmptyString(r.url, r.link, r.href) ?? '#',
    snippet: firstNonEmptyString(r.snippet, r.content, r.description, r.summary, r.body) ?? '',
  };
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

export function formatSearchResultsOutput(results: NormalizedSearchResult[]): string {
  if (results.length === 0) {
    return 'No search results found.';
  }

  return results
    .map((result, index) => {
      const lines = [
        `${index + 1}. ${result.title}`,
        result.url,
      ];
      if (result.snippet) {
        lines.push(result.snippet);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

export function extractSearchResults(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.organic)) return data.organic;
  if (Array.isArray(data?.response?.results)) return data.response.results;
  if (Array.isArray(data?.web?.results)) return data.web.results;
  if (Array.isArray(data?.webPages?.value)) return data.webPages.value;
  return [];
}
