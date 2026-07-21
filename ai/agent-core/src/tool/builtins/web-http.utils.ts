import { createHttpAbortSignal, type IHttpClient, type IHttpResponse } from '@svton/agent-platform';
import type { ToolContext } from '../types';

const globalFetchClient: IHttpClient = {
  async request(
    url: string,
    opts?: {
      method?: 'GET' | 'POST';
      headers?: Record<string, string>;
      body?: string;
      timeoutMs?: number;
      signal?: AbortSignal;
    },
  ) {
    const res = await fetch(url, {
      method: opts?.method ?? 'GET',
      headers: opts?.headers,
      body: opts?.body,
      signal: createHttpAbortSignal(opts),
    });
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      text: () => res.text(),
      json: () => res.json(),
      header: (name: string) => res.headers?.get(name) ?? null,
    } satisfies IHttpResponse;
  },
};

export function resolveHttp(ctx: ToolContext): IHttpClient {
  return ctx.platform.http ?? globalFetchClient;
}
