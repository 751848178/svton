import { describe, expect, it, vi } from 'vitest';
import { LinearIntegration, SlackIntegration } from '../src/integrations';
import type { IToolExecutor, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeContext(): ToolContext {
  return {
    platform: createMockPlatform(),
    sessionId: 'session',
    workingDir: '/repo',
  };
}

function getExecutor(
  integration: typeof SlackIntegration | typeof LinearIntegration,
  credentials: Record<string, string>,
  name: string,
): IToolExecutor {
  const tool = integration.getTools(credentials).find((entry) => entry.definition.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool.executor;
}

async function withThrowingFetch<T>(fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => {
    throw { code: 'fetch_down' };
  }) as any;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('built-in integration error formatting', () => {
  it('normalizes non-Error slack_search fetch failures', async () => {
    const result = await withThrowingFetch(() =>
      getExecutor(SlackIntegration, { botToken: 'xoxb-token' }, 'slack_search').execute(
        { id: 'slack-search', name: 'slack_search', arguments: { query: 'hello' } },
        makeContext(),
      ),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Slack search error: Unknown error');
    expect(result.output).not.toContain('[object Object]');
  });

  it('normalizes non-Error slack_post_message fetch failures', async () => {
    const result = await withThrowingFetch(() =>
      getExecutor(SlackIntegration, { botToken: 'xoxb-token' }, 'slack_post_message').execute(
        {
          id: 'slack-post',
          name: 'slack_post_message',
          arguments: { channel: 'general', text: 'hello' },
        },
        makeContext(),
      ),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Slack post error: Unknown error');
    expect(result.output).not.toContain('[object Object]');
  });

  it('normalizes non-Error linear_list_issues fetch failures', async () => {
    const result = await withThrowingFetch(() =>
      getExecutor(LinearIntegration, { apiKey: 'lin_api_key' }, 'linear_list_issues').execute(
        { id: 'linear-list', name: 'linear_list_issues', arguments: { limit: 1 } },
        makeContext(),
      ),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Linear list issues error: Unknown error');
    expect(result.output).not.toContain('[object Object]');
  });

  it('normalizes non-Error linear_create_issue fetch failures', async () => {
    const result = await withThrowingFetch(() =>
      getExecutor(LinearIntegration, { apiKey: 'lin_api_key' }, 'linear_create_issue').execute(
        {
          id: 'linear-create',
          name: 'linear_create_issue',
          arguments: { teamId: 'team', title: 'Fix issue' },
        },
        makeContext(),
      ),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Linear create issue error: Unknown error');
    expect(result.output).not.toContain('[object Object]');
  });
});
