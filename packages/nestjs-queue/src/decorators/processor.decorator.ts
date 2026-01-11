import { SetMetadata } from '@nestjs/common';
import { QUEUE_PROCESSOR_METADATA } from '../constants';
import type { ProcessorOptions } from '../interfaces';

/**
 * 队列处理器装饰器
 *
 * @example
 * ```typescript
 * @Processor({ name: 'email' })
 * export class EmailProcessor {
 *   @Process('send')
 *   async handleSend(job: Job<EmailData>) {
 *     // 处理发送邮件
 *   }
 * }
 * ```
 */
export const Processor = (options: ProcessorOptions | string): ClassDecorator => {
  const opts = typeof options === 'string' ? { name: options } : options;
  return SetMetadata(QUEUE_PROCESSOR_METADATA, opts);
};
