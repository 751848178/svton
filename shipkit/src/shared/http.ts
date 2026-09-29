// HTTP client for the agent's open API (bearer-token auth, JSON envelope, job polling).

import type { Job } from './types.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

function base(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

export async function api<T>(
  baseUrl: string,
  token: string | undefined,
  method: string,
  apiPath: string,
  body?: unknown,
  timeoutMs = 20_000,
): Promise<T> {
  const url = `${base(baseUrl)}${apiPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) {
      const err = data && typeof data === 'object' && 'error' in data
        ? (data as { error?: { code?: string; message?: string } }).error
        : undefined;
      throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? `${method} ${apiPath} -> HTTP ${res.status}`, data);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'network_error', `${method} ${apiPath}: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function apiUpload(
  baseUrl: string,
  token: string,
  bytes: Uint8Array,
  timeoutMs = 10 * 60_000,
): Promise<{ id: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base(baseUrl)}/api/sources`, {
      method: 'POST',
      signal: controller.signal,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/gzip' },
      body: bytes,
    });
    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) throw new ApiError(res.status, 'http_error', `source upload -> HTTP ${res.status}: ${typeof data === 'string' ? text.slice(0, 200) : JSON.stringify(data)}`);
    return data as { id: string };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'network_error', `source upload: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface WaitOptions {
  pollMs?: number;
  timeoutMs?: number;
  onStatus?: (job: Job) => void;
}

export async function waitForJob(
  baseUrl: string,
  token: string,
  jobId: string,
  opts: WaitOptions = {},
): Promise<Job> {
  const deadline = Date.now() + (opts.timeoutMs ?? 30 * 60_000);
  let last: Job | undefined;
  for (;;) {
    const job = await api<Job>(baseUrl, token, 'GET', `/api/jobs/${jobId}`);
    if (job.status === 'succeeded' || job.status === 'failed') return job;
    if (!last || last.status !== job.status) opts.onStatus?.(job);
    last = job;
    if (Date.now() > deadline) {
      throw new ApiError(0, 'job_timeout', `job ${jobId} still ${job.status} after ${opts.timeoutMs}ms`);
    }
    await sleep(opts.pollMs ?? 2000);
  }
}

export async function fetchLogTail(baseUrl: string, token: string, jobId: string, tail = 60): Promise<string> {
  try {
    const res = await fetch(`${base(baseUrl)}/api/jobs/${jobId}/log?tail=${tail}`, {
      headers: { authorization: `Bearer ${token}` },
      // log fetching must never block the original error report (F36)
      signal: AbortSignal.timeout(8000),
    });
    return (await res.text()).slice(0, 200_000);
  } catch {
    return '';
  }
}
