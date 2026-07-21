import { describe, expect, it } from 'vitest';
import { createWebSearchExecutor, WebSearchExecutor } from '../src/tool/builtins/web';
import { createMockPlatform } from './helpers';
import type { IHttpClient } from '@svton/agent-platform';
import type { ToolContext } from '../src/tool/types';

function makeCtx(): ToolContext {
  return {
    platform: createMockPlatform(),
    sessionId: 's',
    workingDir: '/',
  };
}

function makeCtxWithHttp(http: IHttpClient): ToolContext {
  return {
    platform: createMockPlatform({ http }),
    sessionId: 's',
    workingDir: '/',
  };
}

describe('WebSearchExecutor argument validation', () => {
  it('rejects invalid max_results before provider configuration checks', async () => {
    const result = await new WebSearchExecutor(undefined).execute({
      id: 'search_1',
      name: 'web_search',
      arguments: { query: 'agent test', max_results: 0 },
    }, makeCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"max_results" must be a positive integer');
    expect(result.output).not.toContain('not configured');
  });

  it('preserves request metadata when no search provider is configured', async () => {
    const result = await new WebSearchExecutor(undefined).execute({
      id: 'search_1',
      name: 'web_search',
      arguments: { query: ' \nagent test\t ', max_results: 2 },
    }, makeCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('not configured');
    expect(result.metadata).toMatchObject({
      provider: null,
      query: 'agent test',
      maxResults: 2,
    });
  });

  it('reports a Tavily-specific error when its api key is missing', async () => {
    const result = await new WebSearchExecutor({ provider: 'tavily' }).execute({
      id: 'search_1',
      name: 'web_search',
      arguments: { query: 'agent test', max_results: 4 },
    }, makeCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Tavily API key is not configured');
    expect(result.output).not.toContain('custom search endpoint');
    expect(result.metadata).toMatchObject({
      provider: 'tavily',
      query: 'agent test',
      maxResults: 4,
    });
  });

  it('reports a custom-search-specific error when its endpoint is missing', async () => {
    const result = await new WebSearchExecutor({ provider: 'custom' }).execute({
      id: 'search_1',
      name: 'web_search',
      arguments: { query: 'agent test' },
    }, makeCtx());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Custom search endpoint is not configured');
    expect(result.output).not.toContain('Tavily API key');
  });

  it('rejects successful custom search responses that are not valid JSON', async () => {
    const http: IHttpClient = {
      async request() {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => 'not json',
          json: async () => { throw new Error('Unexpected token o'); },
          header: () => 'text/plain',
        };
      },
    };

    const result = await new WebSearchExecutor('https://search.example/api').execute({
      id: 'search_1',
      name: 'web_search',
      arguments: { query: 'agent test' },
    }, makeCtxWithHttp(http));

    expect(result.isError).toBe(true);
    expect(result.output).toContain('valid JSON');
    expect(result.output).not.toBe('null');
  });

  it('creates executors for explicit provider configs without credentials', () => {
    expect(createWebSearchExecutor({ provider: 'tavily' }, null)).toBeInstanceOf(WebSearchExecutor);
    expect(createWebSearchExecutor({ provider: 'custom' }, null)).toBeInstanceOf(WebSearchExecutor);
  });
});
