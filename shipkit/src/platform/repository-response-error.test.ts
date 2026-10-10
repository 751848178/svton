import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryResponseError, RepositoryRateLimitError } from './repository-response-error.js';

const now = Date.UTC(2026, 9, 10, 9);
test('exhausted 403 and 429 are rate limits, while ordinary denial and redirects remain distinct', () => {
  for (const [status, headers] of [[403, { 'x-ratelimit-remaining': '0' }], [429, {}]] as const) {
    const error = repositoryResponseError(status, headers, now);
    assert(error instanceof RepositoryRateLimitError);
    assert.equal(error.code, 'REPOSITORY_RATE_LIMITED');
    assert.equal(error.retryAt, undefined);
  }
  for (const status of [401, 403]) {
    const error = repositoryResponseError(status, status === 401 ? { 'x-ratelimit-remaining': '0' } : {}, now);
    assert(!(error instanceof RepositoryRateLimitError));
    assert.match(error.message, /credentials were rejected/);
  }
  assert.match(repositoryResponseError(302, { 'x-ratelimit-remaining': '0' }, now).message, /redirects are not followed/);
  assert.match(repositoryResponseError(404, {}, now).message, /does not exist/);
});
test('403 with valid Retry-After identifies a secondary limit without consuming a response body', () => {
  for (const remaining of [undefined, '59']) {
    const error = repositoryResponseError(403, { 'x-ratelimit-remaining': remaining, 'retry-after': '60' }, now);
    assert(error instanceof RepositoryRateLimitError);
    assert.equal(error.retryAt, new Date(now + 60_000).toISOString());
  }
  for (const headers of [{ 'retry-after': 'private' }, { 'x-ratelimit-remaining': '59', 'x-ratelimit-reset': String(now / 1000 + 60) }]) {
    assert(!(repositoryResponseError(403, headers, now) instanceof RepositoryRateLimitError));
  }
  assert(!(repositoryResponseError(401, { 'retry-after': '60' }, now) instanceof RepositoryRateLimitError));
});
test('retry time accepts bounded provider reset, seconds and HTTP date without exposing arbitrary headers', () => {
  const expected = new Date(now + 60_000).toISOString();
  for (const headers of [
    { 'x-ratelimit-reset': String((now + 60_000) / 1000) },
    { 'retry-after': '60' },
    { 'retry-after': new Date(now + 60_000).toUTCString() },
    { 'retry-after': 'invalid', 'x-ratelimit-reset': String((now + 60_000) / 1000) },
  ]) assert.equal((repositoryResponseError(429, headers, now) as RepositoryRateLimitError).retryAt, expected);
  for (const retry of ['-1', '99999999999999999999', 'private-provider-body', String(86_401)]) {
    const error = repositoryResponseError(429, { 'retry-after': retry }, now) as RepositoryRateLimitError;
    assert.equal(error.retryAt, undefined);
    assert(!JSON.stringify(error).includes(retry));
  }
  for (const reset of [String(now / 1000 - 1), String(now / 1000 + 86_401), 'invalid']) {
    assert.equal((repositoryResponseError(429, { 'x-ratelimit-reset': reset }, now) as RepositoryRateLimitError).retryAt, undefined);
  }
});
