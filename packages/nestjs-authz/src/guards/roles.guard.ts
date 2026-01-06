import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTHZ_OPTIONS } from '../constants';

interface AuthzOptions {
  userRoleField?: string;
  enableGlobalGuard?: boolean;
  allowNoRoles?: boolean;
}

/**
 * 角色守卫
 * 检查用户是否具有访问路由所需的角色
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Optional() @Inject(AUTHZ_OPTIONS) private options?: AuthzOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 检查是否为公开路由
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 获取路由所需角色
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 如果没有设置角色要求，根据配置决定是否放行
    if (!requiredRoles || requiredRoles.length === 0) {
      return this.options?.allowNoRoles !== false;
    }

    // 获取用户信息
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // 获取用户角色
    const userRoleField = this.options?.userRoleField || 'role';
    const userRole = this.getUserRole(user, userRoleField);

    if (!userRole) {
      throw new ForbiddenException('User has no role assigned');
    }

    // 检查用户角色是否在所需角色列表中
    const hasRole = this.checkRole(userRole, requiredRoles);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }

  private getUserRole(user: Record<string, unknown>, field: string): string | string[] | undefined {
    // 支持嵌套字段，如 'profile.role'
    const parts = field.split('.');
    let value: unknown = user;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      return value as string[];
    }

    return undefined;
  }

  private checkRole(userRole: string | string[], requiredRoles: string[]): boolean {
    if (Array.isArray(userRole)) {
      // 用户有多个角色，检查是否有任一匹配
      return userRole.some((role) => requiredRoles.includes(role));
    }

    // 单个角色
    return requiredRoles.includes(userRole);
  }
}
