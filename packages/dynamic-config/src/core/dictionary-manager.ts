import type { CacheStrategy } from './cache/types';
import type { DictionaryRepository } from './repository';
import type { DictionaryItem, CreateDictionaryInput, UpdateDictionaryInput } from './types';
import { buildDictionaryTree } from './utils';

export interface DictionaryManagerOptions {
  /** 字典仓储 */
  repository: DictionaryRepository;
  /** 缓存策略（可选） */
  cache?: CacheStrategy;
  /** 缓存 TTL（秒） */
  cacheTtl?: number;
  /** 日志函数 */
  logger?: DictionaryManagerLogger;
}

export interface DictionaryManagerLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, error?: any): void;
}

const defaultLogger: DictionaryManagerLogger = {
  log: (msg) => console.log(`[DictionaryManager] ${msg}`),
  warn: (msg) => console.warn(`[DictionaryManager] ${msg}`),
  error: (msg, err) => console.error(`[DictionaryManager] ${msg}`, err),
};

/**
 * 字典管理器
 */
export class DictionaryManager {
  private repository: DictionaryRepository;
  private cache?: CacheStrategy;
  private cacheTtl: number;
  private logger: DictionaryManagerLogger;

  constructor(options: DictionaryManagerOptions) {
    this.repository = options.repository;
    this.cache = options.cache;
    this.cacheTtl = options.cacheTtl ?? 3600;
    this.logger = options.logger ?? defaultLogger;
  }

  /**
   * 获取所有字典
   */
  async findAll(): Promise<DictionaryItem[]> {
    const cacheKey = 'dictionary:all';

    if (this.cache) {
      const cached = await this.cache.get<DictionaryItem[]>(cacheKey);
      if (cached) return cached;
    }

    const items = await this.repository.findAll();

    if (this.cache) {
      await this.cache.set(cacheKey, items, this.cacheTtl);
    }

    return items;
  }

  /**
   * 根据编码获取字典
   */
  async findByCode(code: string): Promise<DictionaryItem[]> {
    const cacheKey = `dictionary:code:${code}`;

    if (this.cache) {
      const cached = await this.cache.get<DictionaryItem[]>(cacheKey);
      if (cached) return cached;
    }

    const items = await this.repository.findByCode(code);

    if (this.cache) {
      await this.cache.set(cacheKey, items, this.cacheTtl);
    }

    return items;
  }

  /**
   * 获取字典树
   */
  async getTree(code: string): Promise<DictionaryItem[]> {
    const cacheKey = `dictionary:tree:${code}`;

    if (this.cache) {
      const cached = await this.cache.get<DictionaryItem[]>(cacheKey);
      if (cached) return cached;
    }

    const items = await this.repository.findByCode(code);
    const tree = buildDictionaryTree(items);

    if (this.cache) {
      await this.cache.set(cacheKey, tree, this.cacheTtl);
    }

    return tree;
  }

  /**
   * 根据 ID 获取字典
   */
  async findById(id: number): Promise<DictionaryItem | null> {
    return this.repository.findById(id);
  }

  /**
   * 创建字典
   */
  async create(data: CreateDictionaryInput): Promise<DictionaryItem> {
    const item = await this.repository.create(data);
    await this.invalidateCache(data.code);
    this.logger.log(`Dictionary created: ${data.code}/${data.value}`);
    return item;
  }

  /**
   * 更新字典
   */
  async update(id: number, data: UpdateDictionaryInput): Promise<DictionaryItem> {
    const existing = await this.repository.findById(id);
    const item = await this.repository.update(id, data);

    // 清除相关缓存
    if (existing) {
      await this.invalidateCache(existing.code);
    }
    if (data.value && existing?.code) {
      await this.invalidateCache(existing.code);
    }

    this.logger.log(`Dictionary updated: ${id}`);
    return item;
  }

  /**
   * 删除字典
   */
  async delete(id: number): Promise<void> {
    const existing = await this.repository.findById(id);
    await this.repository.delete(id);

    if (existing) {
      await this.invalidateCache(existing.code);
    }

    this.logger.log(`Dictionary deleted: ${id}`);
  }

  /**
   * 清除缓存
   */
  private async invalidateCache(code: string): Promise<void> {
    if (!this.cache) return;

    await Promise.all([
      this.cache.delete('dictionary:all'),
      this.cache.delete(`dictionary:code:${code}`),
      this.cache.delete(`dictionary:tree:${code}`),
    ]);
  }

  /**
   * 清除所有缓存
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
      this.logger.log('Dictionary cache cleared');
    }
  }
}
