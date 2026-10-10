import type { IncomingHttpHeaders } from 'node:http';

export class RepositoryRateLimitError extends Error {
  readonly code = 'REPOSITORY_RATE_LIMITED';
  constructor(readonly retryAt?: string) {
    super('Repository metadata rate limit reached; wait for the provider quota to recover');
    this.name = 'RepositoryRateLimitError';
  }
}

function retryTime(headers: IncomingHttpHeaders, now: number): string | undefined {
  const retry = headers['retry-after'], reset = headers['x-ratelimit-reset'];
  let time: number | undefined;
  if (typeof retry === 'string') {
    time = /^\d+$/.test(retry) ? now + Number(retry) * 1000 : Date.parse(retry);
  }
  if (!Number.isFinite(time) && typeof reset === 'string' && /^\d+$/.test(reset)) time = Number(reset) * 1000;
  if (time === undefined || !Number.isSafeInteger(time) || time < now || time > now + 86_400_000) return undefined;
  return new Date(time).toISOString();
}

/** Classify status and trusted headers only; provider bodies never become diagnostics. */
export function repositoryResponseError(status: number | undefined, headers: IncomingHttpHeaders, now = Date.now()): Error {
  const secondaryRetry = status === 403 ? retryTime({ 'retry-after': headers['retry-after'] }, now) : undefined;
  if (status === 429 || status === 403 && (headers['x-ratelimit-remaining'] === '0' || secondaryRetry)) {
    return new RepositoryRateLimitError(retryTime(headers, now));
  }
  return new Error(status === 401 || status === 403 ? 'Repository credentials were rejected or read permission is missing'
    : status === 404 ? 'Repository, ref, or definition file does not exist'
      : `Repository metadata request failed (${status}); redirects are not followed`);
}
