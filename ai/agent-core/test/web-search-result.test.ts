import { describe, expect, it } from 'vitest';
import type { IHttpClient } from '@svton/agent-platform';
import { WebSearchExecutor } from '../src/tool/builtins/web';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCall(): ToolCall {
  return {
    id: 'search-result',
    name: 'web_search',
    arguments: { query: 'agent result contract', max_results: 1 },
  };
}

function makeCtx(http: IHttpClient): ToolContext {
  return {
    platform: createMockPlatform({ http }),
    sessionId: 's',
    workingDir: '/',
  };
}

describe('web_search result handling', () => {
  it('normalizes non-string result fields before returning output and metadata', async () => {
    const http: IHttpClient = {
      async request() {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          header: () => 'application/json',
          async text() {
            return '';
          },
          async json() {
            return {
              results: [
                {
                  title: { bad: true },
                  url: { href: 'https://example.com' },
                  snippet: 123,
                },
              ],
            };
          },
        };
      },
    };

    const result = await new WebSearchExecutor('https://search.example/api').execute(
      makeCall(),
      makeCtx(http),
    );

    expect(result.isError).toBeFalsy();
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      resultCount: 1,
      searchResults: [
        {
          title: 'Untitled',
          url: '#',
          snippet: '',
        },
      ],
    });
  });

  it('normalizes non-Error transport failures', async () => {
    const http: IHttpClient = {
      async request() {
        throw { code: 'search_down' };
      },
    };

    const result = await new WebSearchExecutor('https://search.example/api').execute(
      makeCall(),
      makeCtx(http),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Search error: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      provider: 'custom',
      query: 'agent result contract',
      maxResults: 1,
    });
  });
});
