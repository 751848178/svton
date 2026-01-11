import { Inject } from '@nestjs/common';
import { getQueueToken } from '../utils';

/**
 * 注入队列实例
 *
 * @example
 * ```typescript
 * constructor(@InjectQueue('email') private emailQueue: Queue) {}
 * ```
 */
export const InjectQueue = (name: string): ParameterDecorator => {
  return Inject(getQueueToken(name));
};
