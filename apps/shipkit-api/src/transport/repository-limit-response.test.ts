import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException } from '@nestjs/common';
import { repositoryLimitResponse } from './repository-limit-response.js';

const now = Date.UTC(2026, 9, 10, 9);
test('typed SDK and repository-check HTTP limits share a controlled response', () => {
  const retryAt = new Date(now + 60_000).toISOString();
  const error = Object.assign(new Error('provider secret body'), { code: 'REPOSITORY_RATE_LIMITED', retryAt });
  const expected = { code: 'REPOSITORY_RATE_LIMITED', message: '仓库服务已限流，请等待配额恢复后重试', retryAt };
  assert.deepEqual(repositoryLimitResponse(error, now), expected);
  assert.deepEqual(repositoryLimitResponse(new HttpException({ ...error, message: 'private' }, 429), now), expected);
  assert.equal(repositoryLimitResponse(new Error('rate limit'), now), undefined);
  assert.equal(repositoryLimitResponse(new HttpException('provider denial', 403), now), undefined);
});
test('invalid or unbounded retry values and provider data are omitted', () => {
  for (const retryAt of ['private', new Date(now - 1).toISOString(), new Date(now + 86_400_001).toISOString(),
    new Date(now + 60_000).toUTCString(), { secret: 'private' }]) {
    const result = repositoryLimitResponse({ code: 'REPOSITORY_RATE_LIMITED', retryAt, message: 'private' }, now);
    assert(result);
    assert(!('retryAt' in result));
    assert(!JSON.stringify(result).includes('private'));
  }
});
