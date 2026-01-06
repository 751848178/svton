import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * 角色装饰器
 * 用于标记路由需要的角色
 *
 * @example
 * ```typescript
 * @Roles('admin', 'moderator')
 * @Get('users')
 * findAll() {}
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
