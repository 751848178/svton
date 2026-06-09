import { SetMetadata } from '@nestjs/common';
import type { AuthzPermissionInput } from '@svton/authz';

export const PERMISSIONS_KEY = 'permissions';

/**
 * 权限装饰器
 * 用于标记路由需要的权限
 *
 * @example
 * ```typescript
 * @Permissions('team:read', { resource: 'member', action: 'invite' })
 * @Get('teams/:id')
 * findOne() {}
 * ```
 */
export const Permissions = (...permissions: AuthzPermissionInput[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
