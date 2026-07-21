import type { ToolResult } from '@svton/agent-core';
import type { ContentBlock, DisplayToolCall, SearchResultEntry } from '../types';

export function readWebSearchBlock(toolName: string, result: ToolResult, call?: DisplayToolCall): ContentBlock | null {
  if (toolName !== 'web_search' || result.isError) return null;

  const results = readSearchResults(result.metadata?.searchResults);
  if (results.length === 0) return null;
  return {
    type: 'web_search',
    query: readSearchQuery(result, call),
    results,
  };
}

function readSearchResults(value: unknown): SearchResultEntry[] {
  if (Array.isArray(value)) return value.map(normalizeSearchResult);
  if (value && typeof value === 'object') return [normalizeSearchResult(value)];
  return [];
}

function normalizeSearchResult(value: unknown): SearchResultEntry {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    title: typeof record.title === 'string' ? record.title : '',
    url: typeof record.url === 'string' ? record.url : '',
    snippet: typeof record.snippet === 'string' ? record.snippet : undefined,
  };
}

function readSearchQuery(result: ToolResult, call?: DisplayToolCall): string {
  if (typeof result.metadata?.query === 'string') return result.metadata.query;
  const query = call?.arguments && typeof call.arguments === 'object'
    ? (call.arguments as Record<string, unknown>).query
    : undefined;
  return typeof query === 'string' ? query : '';
}
