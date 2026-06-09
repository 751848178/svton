import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import {
  createAuthorizer,
  normalizePermissionGrants,
  normalizeRoleAssignments,
  type AuthzPermissionGrant,
  type AuthzPermissionInput,
  type AuthzRoleAssignment,
  type AuthzSchema,
  type AuthzSubject,
} from '@svton/authz';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTHZ_OPTIONS } from '../constants';
import type {
  AuthzAssignmentsResolver,
  AuthzResolvedAssignments,
  AuthzScopeResolver,
} from '../interfaces';

interface AuthzOptions {
  userRoleField?: string;
  userPermissionsField?: string;
  enableGlobalGuard?: boolean;
  allowNoRoles?: boolean;
  schema?: AuthzSchema;
  getAssignments?: AuthzAssignmentsResolver;
  getScope?: AuthzScopeResolver;
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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authorizer = createAuthorizer(this.options?.schema);

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
    const requiredPermissions = this.reflector.getAllAndOverride<AuthzPermissionInput[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置权限要求，根据配置决定是否放行
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return this.options?.allowNoRoles !== false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user as Record<string, unknown> | undefined;
    const subject = await this.resolveSubject(context, user);

    if (
      !user &&
      subject.roles.length === 0 &&
      subject.permissions.length === 0
    ) {
      throw new ForbiddenException('User not authenticated');
    }

    const scope = await this.options?.getScope?.(context);

    if (requiredRoles && requiredRoles.length > 0) {
      const roleDecision = authorizer.hasRole({
        subject,
        roles: requiredRoles,
        scope,
      });

      if (!roleDecision.allowed) {
        throw new ForbiddenException(
          `Access denied. Required roles: ${requiredRoles.join(', ')}`,
        );
      }
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      let denied = false;

      for (const permission of requiredPermissions) {
        const decision = authorizer.can({
          subject,
          permission,
          scope,
        });

        if (decision.allowed) {
          return true;
        }

        if (decision.reason === 'denied') {
          denied = true;
        }
      }

      throw new ForbiddenException(
        denied
          ? 'Access denied by authorization policy'
          : 'Access denied. Missing required permissions',
      );
    }

    return true;
  }

  private async resolveSubject(
    context: ExecutionContext,
    user?: Record<string, unknown>,
  ): Promise<AuthzSubject & {
    roles: AuthzRoleAssignment[];
    permissions: AuthzPermissionGrant[];
  }> {
    const resolvedAssignments = (await this.options?.getAssignments?.(context)) ?? {};
    const userRoles = this.getUserRoles(user, this.options?.userRoleField || 'role');
    const userPermissions = this.getUserPermissions(
      user,
      this.options?.userPermissionsField || 'permissions',
    );

    return {
      roles: [
        ...normalizeRoleAssignments(userRoles),
        ...normalizeRoleAssignments(resolvedAssignments.roles),
      ],
      permissions: [
        ...normalizePermissionGrants(userPermissions),
        ...normalizePermissionGrants(resolvedAssignments.permissions),
      ],
    };
  }

  private getUserRoles(
    user: Record<string, unknown> | undefined,
    field: string,
  ): string[] | AuthzRoleAssignment[] | undefined {
    const value = this.getRoleFieldValue(user, field);

    if (typeof value === 'string') {
      return [value];
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return value as string[];
    }

    if (
      Array.isArray(value) &&
      value.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          'role' in (item as Record<string, unknown>) &&
          typeof (item as Record<string, unknown>).role === 'string',
      )
    ) {
      return value as AuthzRoleAssignment[];
    }

    return undefined;
  }

  private getUserPermissions(
    user: Record<string, unknown> | undefined,
    field: string,
  ): AuthzResolvedAssignments['permissions'] | undefined {
    const value = this.getNestedValue(user, field);

    if (!Array.isArray(value)) {
      return undefined;
    }

    return value as AuthzResolvedAssignments['permissions'];
  }

  private getNestedValue(
    source: Record<string, unknown> | undefined,
    field: string,
  ): unknown {
    if (!source) {
      return undefined;
    }

    const parts = field.split('.');
    let value: unknown = source;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
        continue;
      }

      return undefined;
    }

    return value;
  }

  private getRoleFieldValue(
    user: Record<string, unknown> | undefined,
    field: string,
  ): unknown {
    const directValue = this.getNestedValue(user, field);
    if (directValue !== undefined) {
      return directValue;
    }

    if (field === 'role') {
      return this.getNestedValue(user, 'roles');
    }

    return undefined;
  }
}
