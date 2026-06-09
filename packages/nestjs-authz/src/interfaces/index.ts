import type { ExecutionContext, ModuleMetadata, Type } from '@nestjs/common';
import type {
  AuthzPermissionGrantInput,
  AuthzRoleAssignment,
  AuthzSchema,
  AuthzScope,
} from '@svton/authz';

type Awaitable<T> = T | Promise<T>;

export interface AuthzResolvedAssignments {
  roles?: string[] | AuthzRoleAssignment[];
  permissions?: AuthzPermissionGrantInput[];
}

export type AuthzAssignmentsResolver = (
  context: ExecutionContext,
) => Awaitable<AuthzResolvedAssignments | undefined>;

export type AuthzScopeResolver = (context: ExecutionContext) => Awaitable<AuthzScope | undefined>;

/**
 * AuthZ 模块配置选项
 */
export interface AuthzModuleOptions {
  userRoleField?: string;
  userPermissionsField?: string;
  enableGlobalGuard?: boolean;
  allowNoRoles?: boolean;
  schema?: AuthzSchema;
  getAssignments?: AuthzAssignmentsResolver;
  getScope?: AuthzScopeResolver;
}

/**
 * 异步配置选项工厂接口
 */
export interface AuthzOptionsFactory {
  createAuthzOptions(): Promise<AuthzModuleOptions> | AuthzModuleOptions;
}

/**
 * 异步模块配置选项
 */
export interface AuthzModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<AuthzOptionsFactory>;
  useClass?: Type<AuthzOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<AuthzModuleOptions> | AuthzModuleOptions;
  inject?: unknown[];
}
