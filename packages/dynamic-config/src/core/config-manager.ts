import type { CacheStrategy } from './cache/types';
import type { ConfigRepository } from './repository';
import type { ConfigItem, BatchUpdateConfig, ConfigValueType } from './types';
import {
  parseConfigValue,
  stringifyConfigValue,
  inferValueType,
  extractCategory,
  buildNestedConfig,
} from './utils';

export interface ConfigManagerOptions {
  /** 配置仓储 */
  repository: ConfigRepository;
  /** 缓存策略 */
  cache: CacheStrategy;
  /** 是否在初始化时预加载所有配置 */
  preload?: boolean;
  /** 日志函数 */
  logger?: ConfigManagerLogger;
}

export interface ConfigManagerLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, error?: any): void;
}

const defaultLogger: ConfigManagerLogger = {
  log: (msg) => console.log(`[ConfigManager] ${msg}`),
  warn: (msg) => console.warn(`[ConfigManager] ${msg}`),
  error: (msg, err) => console.error(`[ConfigManager] ${msg}`, err),
};

/**
 * 配置管理器
 * 核心类，提供配置的读取、写入、缓存管理
 */
export class ConfigManager {
  private repository: ConfigRepository;
  private cache: CacheStrategy;
  private logger: ConfigManagerLogger;
  private initialized = false;

  constructor(options: ConfigManagerOptions) {
    this.repository = options.repository;
    this.cache = options.cache;
    this.logger = options.logger ?? defaultLogger;

    if (options.preload !== false) {
      this.loadAllConfigs().catch((err) => {
        this.logger.error('Failed to preload configs', err);
      });
    }
  }

  /**
   * 加载所有配置到缓存
   */
  async loadAllConfigs(): Promise<void> {
    try {
      const configs = await this.repository.findAll();
      const entries = configs.map((config) => ({
        key: config.key,
        value: parseConfigValue(config.value, config.type as ConfigValueType),
      }));

      await this.cache.mset(entries);
      this.initialized = true;
      this.logger.log(`Loaded ${configs.length} configs into cache`);
    } catch (error) {
      this.logger.error('Failed to load configs', error);
      throw error;
    }
  }

  /**
   * 获取配置值
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    // 1. 从缓存读取
    const cached = await this.cache.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // 2. 从数据库读取
    try {
      const config = await this.repository.findByKey(key);
      if (config) {
        const value = parseConfigValue(config.value, config.type as ConfigValueType);
        await this.cache.set(key, value);
        return value as T;
      }
    } catch (error) {
      this.logger.error(`Failed to get config: ${key}`, error);
    }

    // 3. 返回默认值
    return defaultValue as T;
  }

  /**
   * 获取字符串配置
   */
  async getString(key: string, defaultValue = ''): Promise<string> {
    const value = await this.get<string>(key, defaultValue);
    return String(value);
  }

  /**
   * 获取数字配置
   */
  async getNumber(key: string, defaultValue = 0): Promise<number> {
    const value = await this.get<number>(key, defaultValue);
    return Number(value);
  }

  /**
   * 获取布尔配置
   */
  async getBoolean(key: string, defaultValue = false): Promise<boolean> {
    const value = await this.get<boolean>(key, defaultValue);
    return Boolean(value);
  }

  /**
   * 获取 JSON 配置
   */
  async getJson<T = any>(key: string, defaultValue?: T): Promise<T> {
    return this.get<T>(key, defaultValue);
  }

  /**
   * 设置配置值
   */
  async set(key: string, value: any): Promise<void> {
    try {
      const valueStr = stringifyConfigValue(value);
      const existing = await this.repository.findByKey(key);

      if (existing) {
        await this.repository.update(key, { value: valueStr });
      } else {
        await this.repository.create({
          key,
          value: valueStr,
          type: inferValueType(value),
          category: extractCategory(key),
          label: key,
        });
      }

      // 更新缓存
      await this.cache.set(key, value);
      this.logger.log(`Config updated: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to set config: ${key}`, error);
      throw error;
    }
  }

  /**
   * 批量更新配置
   */
  async batchUpdate(configs: BatchUpdateConfig[]): Promise<void> {
    const originalValues = new Map<string, any>();

    try {
      // 备份原始值
      for (const config of configs) {
        const original = await this.cache.get(config.key);
        if (original !== undefined) {
          originalValues.set(config.key, original);
        }
      }

      // 准备更新数据
      const updates = configs.map(({ key, value }) => ({
        key,
        value: stringifyConfigValue(value),
      }));

      // 批量更新数据库
      await this.repository.batchUpdateValues(updates);

      // 更新缓存
      const cacheEntries = configs.map(({ key, value }) => ({ key, value }));
      await this.cache.mset(cacheEntries);

      this.logger.log(`Batch updated ${configs.length} configs`);
    } catch (error) {
      // 回滚缓存
      for (const [key, value] of originalValues) {
        await this.cache.set(key, value).catch(() => {});
      }

      this.logger.error('Batch update failed, cache rolled back', error);
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async delete(key: string): Promise<void> {
    try {
      await this.repository.delete(key);
      await this.cache.delete(key);
      this.logger.log(`Config deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete config: ${key}`, error);
      throw error;
    }
  }

  /**
   * 获取分类配置
   */
  async getByCategory(category: string): Promise<ConfigItem[]> {
    const configs = await this.repository.findByCategory(category);
    return configs.map((config) => ({
      ...config,
      value: parseConfigValue(config.value, config.type as ConfigValueType),
    }));
  }

  /**
   * 获取公开配置
   */
  async getPublicConfigs(): Promise<Record<string, any>> {
    const configs = await this.repository.findPublic();
    const result: Record<string, any> = {};

    for (const config of configs) {
      result[config.key] = parseConfigValue(config.value, config.type as ConfigValueType);
    }

    return result;
  }

  /**
   * 获取系统配置（嵌套结构）
   */
  async getSystemConfig(): Promise<Record<string, any>> {
    const configs = await this.repository.findAll();
    const parsed = configs.map((config) => ({
      key: config.key,
      value: parseConfigValue(config.value, config.type as ConfigValueType),
    }));

    return buildNestedConfig(parsed);
  }

  /**
   * 重新加载配置
   */
  async reload(): Promise<void> {
    await this.cache.clear();
    await this.loadAllConfigs();
    this.logger.log('Configs reloaded');
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
