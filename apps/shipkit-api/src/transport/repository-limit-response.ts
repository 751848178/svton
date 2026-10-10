import { HttpException } from '@nestjs/common';

/** Only the typed provider limit contract may change the public retry response. */
export function repositoryLimitResponse(error: unknown, now = Date.now()) {
  const candidate = error instanceof HttpException ? error.getResponse() : error;
  if (!candidate || typeof candidate !== 'object' || !('code' in candidate)
    || candidate.code !== 'REPOSITORY_RATE_LIMITED') return undefined;
  const value = 'retryAt' in candidate ? candidate.retryAt : undefined;
  const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
  const retryAt = Number.isSafeInteger(timestamp) && timestamp >= now && timestamp <= now + 86_400_000
    && value === new Date(timestamp).toISOString() ? value : undefined;
  return { code: 'REPOSITORY_RATE_LIMITED', message: '仓库服务已限流，请等待配额恢复后重试',
    ...(retryAt ? { retryAt } : {}) };
}
