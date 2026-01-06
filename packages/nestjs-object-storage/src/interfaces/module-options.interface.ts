import { ModuleMetadata, Type } from '@nestjs/common';
import { ObjectStorageAdapter, ObjectStorageAdapterFactory } from './object-storage.interface';

/**
 * 对象存储模块配置选项
 */
export interface ObjectStorageModuleOptions {
  /** 默认 bucket */
  defaultBucket?: string;
  /** 公开访问基础 URL（CDN 域名等） */
  publicBaseUrl?: string;
  /** 默认预签名过期时间（秒） */
  defaultExpiresInSeconds?: number;
  /** 适配器实例或工厂 */
  adapter: ObjectStorageAdapter | ObjectStorageAdapterFactory;
}

/**
 * 异步配置选项工厂接口
 */
export interface ObjectStorageOptionsFactory {
  createObjectStorageOptions(): Promise<ObjectStorageModuleOptions> | ObjectStorageModuleOptions;
}

/**
 * 异步模块配置选项
 */
export interface ObjectStorageModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /** 使用已存在的工厂实例 */
  useExisting?: Type<ObjectStorageOptionsFactory>;
  /** 使用类作为工厂 */
  useClass?: Type<ObjectStorageOptionsFactory>;
  /** 使用工厂函数 */
  useFactory?: (...args: unknown[]) => Promise<ObjectStorageModuleOptions> | ObjectStorageModuleOptions;
  /** 注入依赖 */
  inject?: unknown[];
}
