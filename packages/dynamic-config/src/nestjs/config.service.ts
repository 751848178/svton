import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigManager, type ConfigManagerOptions } from '../core/config-manager';
import type { ConfigItem, BatchUpdateConfig } from '../core/types';
import {
  CONFIG_REPOSITORY,
  CACHE_STRATEGY,
  CONFIG_MODULE_OPTIONS,
} from './constants';
import type { CacheStrategy } from '../core/cache/types';
import type { ConfigRepository } from '../core/repository';
import type { DynamicConfigModuleOptions } from './interfaces';

/**
 * NestJS 配置服务
 * 封装 ConfigManager，提供 NestJS 风格的依赖注入
 */
@Injectable()
export class DynamicConfigService implements OnModuleInit {
  private readonly logger = new Logger(DynamicConfigService.name);
  private manager: ConfigManager;

  constructor(
    @Inject(CONFIG_REPOSITORY) private repository: ConfigRepository,
    @Inject(CACHE_STRATEGY) private cache: CacheStrategy,
    @Inject(CONFIG_MODULE_OPTIONS) private options: DynamicConfigModuleOptions,
  ) {
    const managerOptions: ConfigManagerOptions = {
      repository: this.repository,
      cache: this.cache,
      preload: false, // 在 onModuleInit 中手动加载
      logger: {
        log: (msg) => this.logger.log(msg),
        warn: (msg) => this.logger.warn(msg),
        error: (msg, err) => this.logger.error(msg, err),
      },
    };

    this.manager = new ConfigManager(managerOptions);
  }

  async onModuleInit() {
    if (this.options.preload !== false) {
      await this.manager.loadAllConfigs();
      this.logger.log('Dynamic config service initialized');
    }
  }

  /**
   * 获取配置值
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    return this.manager.get<T>(key, defaultValue);
  }

  /**
   * 获取字符串配置
   */
  async getString(key: string, defaultValue = ''): Promise<string> {
    return this.manager.getString(key, defaultValue);
  }

  /**
   * 获取数字配置
   */
  async getNumber(key: string, defaultValue = 0): Promise<number> {
    return this.manager.getNumber(key, defaultValue);
  }

  /**
   * 获取布尔配置
   */
  async getBoolean(key: string, defaultValue = false): Promise<boolean> {
    return this.manager.getBoolean(key, defaultValue);
  }

  /**
   * 获取 JSON 配置
   */
  async getJson<T = any>(key: string, defaultValue?: T): Promise<T> {
    return this.manager.getJson<T>(key, defaultValue);
  }

  /**
   * 设置配置值
   */
  async set(key: string, value: any): Promise<void> {
    return this.manager.set(key, value);
  }

  /**
   * 批量更新配置
   */
  async batchUpdate(configs: BatchUpdateConfig[]): Promise<void> {
    return this.manager.batchUpdate(configs);
  }

  /**
   * 删除配置
   */
  async delete(key: string): Promise<void> {
    return this.manager.delete(key);
  }

  /**
   * 获取分类配置
   */
  async getByCategory(category: string): Promise<ConfigItem[]> {
    return this.manager.getByCategory(category);
  }

  /**
   * 获取公开配置
   */
  async getPublicConfigs(): Promise<Record<string, any>> {
    return this.manager.getPublicConfigs();
  }

  /**
   * 获取系统配置（嵌套结构）
   */
  async getSystemConfig(): Promise<Record<string, any>> {
    return this.manager.getSystemConfig();
  }

  /**
   * 重新加载配置
   */
  async reload(): Promise<void> {
    return this.manager.reload();
  }

  /**
   * 获取底层 ConfigManager 实例
   */
  getManager(): ConfigManager {
    return this.manager;
  }
}
