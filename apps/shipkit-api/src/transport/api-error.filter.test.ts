import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException, type ArgumentsHost } from '@nestjs/common';
import { ApiErrorFilter } from './api-error.filter.js';

function capture(error: unknown) {
  let status = 0, body: Record<string, unknown> = {};
  const response = { status(value: number) { status = value; return this; },
    json(value: Record<string, unknown>) { body = value; } };
  const host = { switchToHttp: () => ({ getResponse: () => response,
    getRequest: () => ({ localContext: { requestId: 'limit-test' } }) }) } as unknown as ArgumentsHost;
  new ApiErrorFilter().catch(error, host);
  return { status, body };
}
test('SDK errors and repository-check exceptions produce HTTP 429 with no provider text', () => {
  const retryAt = new Date(Date.now() + 60_000).toISOString();
  const contract = { code: 'REPOSITORY_RATE_LIMITED', retryAt, message: 'private-provider-body' };
  for (const error of [Object.assign(new Error(contract.message), contract), new HttpException(contract, 429)]) {
    assert.deepEqual(capture(error), { status: 429, body: { code: 'REPOSITORY_RATE_LIMITED',
      message: '仓库服务已限流，请等待配额恢复后重试', retryAt, requestId: 'limit-test' } });
  }
  const denial = capture(new HttpException('权限不足', 403));
  assert.equal(denial.status, 403);
  assert.equal(denial.body.code, '403');
});
