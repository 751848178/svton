import { ModuleMetadata, Type } from '@nestjs/common';
import { WechatProviderConfig } from './wechat.interface';

/**
 * OAuth 模块配置
 */
export interface OAuthModuleOptions {
  /** 微信配置 (支持多个平台) */
  wechat?: WechatProviderConfig | WechatProviderConfig[];
  /** State 生成器 (用于防 CSRF) */
  stateGenerator?: () => string | Promise<string>;
  /** State 验证器 */
  stateValidator?: (state: string) => boolean | Promise<boolean>;
}

/**
 * OAuth 配置工厂接口
 */
export interface OAuthOptionsFactory {
  createOAuthOptions(): Promise<OAuthModuleOptions> | OAuthModuleOptions;
}

/**
 * OAuth 异步配置
 */
export interface OAuthModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<OAuthOptionsFactory>;
  useClass?: Type<OAuthOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<OAuthModuleOptions> | OAuthModuleOptions;
  inject?: unknown[];
}
