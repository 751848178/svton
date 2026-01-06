import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 公开路由装饰器
 * 标记路由为公开访问，跳过角色检查
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * health() {}
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
