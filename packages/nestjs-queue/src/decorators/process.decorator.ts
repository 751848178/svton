import { SetMetadata } from '@nestjs/common';
import { QUEUE_PROCESS_METADATA } from '../constants';
import type { ProcessOptions } from '../interfaces';

/**
 * Job 处理方法装饰器
 *
 * @example
 * ```typescript
 * @Process('send')
 * async handleSend(job: Job<EmailData>) {}
 *
 * @Process({ name: 'bulk', concurrency: 5 })
 * async handleBulk(job: Job<BulkEmailData>) {}
 * ```
 */
export const Process = (options?: ProcessOptions | string): MethodDecorator => {
  const opts = typeof options === 'string' ? { name: options } : options;
  return SetMetadata(QUEUE_PROCESS_METADATA, opts);
};
