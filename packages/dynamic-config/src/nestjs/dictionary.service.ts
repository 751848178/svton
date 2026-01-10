import { Injectable, Inject, Logger } from '@nestjs/common';
import { DictionaryManager, type DictionaryManagerOptions } from '../core/dictionary-manager';
import type { DictionaryItem, CreateDictionaryInput, UpdateDictionaryInput } from '../core/types';
import { DICTIONARY_REPOSITORY, CACHE_STRATEGY } from './constants';
import type { CacheStrategy } from '../core/cache/types';
import type { DictionaryRepository } from '../core/repository';

/**
 * NestJS 字典服务
 * 封装 DictionaryManager，提供 NestJS 风格的依赖注入
 */
@Injectable()
export class DynamicDictionaryService {
  private readonly logger = new Logger(DynamicDictionaryService.name);
  private manager: DictionaryManager;

  constructor(
    @Inject(DICTIONARY_REPOSITORY) private repository: DictionaryRepository,
    @Inject(CACHE_STRATEGY) private cache: CacheStrategy,
  ) {
    const managerOptions: DictionaryManagerOptions = {
      repository: this.repository,
      cache: this.cache,
      logger: {
        log: (msg) => this.logger.log(msg),
        warn: (msg) => this.logger.warn(msg),
        error: (msg, err) => this.logger.error(msg, err),
      },
    };

    this.manager = new DictionaryManager(managerOptions);
  }

  /**
   * 获取所有字典
   */
  async findAll(): Promise<DictionaryItem[]> {
    return this.manager.findAll();
  }

  /**
   * 根据编码获取字典
   */
  async findByCode(code: string): Promise<DictionaryItem[]> {
    return this.manager.findByCode(code);
  }

  /**
   * 获取字典树
   */
  async getTree(code: string): Promise<DictionaryItem[]> {
    return this.manager.getTree(code);
  }

  /**
   * 根据 ID 获取字典
   */
  async findById(id: number): Promise<DictionaryItem | null> {
    return this.manager.findById(id);
  }

  /**
   * 创建字典
   */
  async create(data: CreateDictionaryInput): Promise<DictionaryItem> {
    return this.manager.create(data);
  }

  /**
   * 更新字典
   */
  async update(id: number, data: UpdateDictionaryInput): Promise<DictionaryItem> {
    return this.manager.update(id, data);
  }

  /**
   * 删除字典
   */
  async delete(id: number): Promise<void> {
    return this.manager.delete(id);
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    return this.manager.clearCache();
  }

  /**
   * 获取底层 DictionaryManager 实例
   */
  getManager(): DictionaryManager {
    return this.manager;
  }
}
