import type { ModuleMetadata, Type } from '@nestjs/common';

/**
 * AuthZ 模块配置选项
 */
export interface AuthzModuleOptions {
  userRoleField?: string;
  enableGlobalGuard?: boolean;
  allowNoRoles?: boolean;
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
