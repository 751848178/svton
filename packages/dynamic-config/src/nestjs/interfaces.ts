import type { Type, ModuleMetadata } from '@nestjs/common';
import type { CacheStrategy } from '../core/cache/types';
import type { ConfigRepository, DictionaryRepository } from '../core/repository';

/**
 * 动态配置模块选项
 */
export interface DynamicConfigModuleOptions {
  /**
   * 是否注册默认 Controller
   * @default true
   */
  registerController?: boolean;

  /**
   * 自定义 Config Controller
   */
  configController?: Type<any>;

  /**
   * 自定义 Dictionary Controller
   */
  dictionaryController?: Type<any>;

  /**
   * 缓存策略实例
   */
  cache?: CacheStrategy;

  /**
   * Config Repository 实例
   */
  configRepository?: ConfigRepository;

  /**
   * Dictionary Repository 实例
   */
  dictionaryRepository?: DictionaryRepository;

  /**
   * 是否预加载配置
   * @default true
   */
  preload?: boolean;

  /**
   * 是否全局模块
   * @default false
   */
  isGlobal?: boolean;
}

/**
 * 异步模块选项
 */
export interface DynamicConfigModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * 是否全局模块
   */
  isGlobal?: boolean;

  /**
   * 使用工厂函数
   */
  useFactory?: (
    ...args: any[]
  ) => Promise<DynamicConfigModuleOptions> | DynamicConfigModuleOptions;

  /**
   * 注入依赖
   */
  inject?: any[];

  /**
   * 使用已存在的实例
   */
  useExisting?: Type<DynamicConfigModuleOptionsFactory>;

  /**
   * 使用类
   */
  useClass?: Type<DynamicConfigModuleOptionsFactory>;
}

/**
 * 选项工厂接口
 */
export interface DynamicConfigModuleOptionsFactory {
  createDynamicConfigOptions():
    | Promise<DynamicConfigModuleOptions>
    | DynamicConfigModuleOptions;
}
