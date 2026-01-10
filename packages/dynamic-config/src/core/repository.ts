import type {
  ConfigItem,
  CreateConfigInput,
  UpdateConfigInput,
  DictionaryItem,
  CreateDictionaryInput,
  UpdateDictionaryInput,
} from './types';

/**
 * 配置仓储接口
 */
export interface ConfigRepository {
  /**
   * 获取所有配置
   */
  findAll(): Promise<ConfigItem[]>;

  /**
   * 根据 key 获取配置
   */
  findByKey(key: string): Promise<ConfigItem | null>;

  /**
   * 根据分类获取配置
   */
  findByCategory(category: string): Promise<ConfigItem[]>;

  /**
   * 获取公开配置
   */
  findPublic(): Promise<ConfigItem[]>;

  /**
   * 创建配置
   */
  create(data: CreateConfigInput): Promise<ConfigItem>;

  /**
   * 更新配置
   */
  update(key: string, data: UpdateConfigInput): Promise<ConfigItem>;

  /**
   * 删除配置
   */
  delete(key: string): Promise<void>;

  /**
   * 批量更新配置值
   */
  batchUpdateValues(updates: Array<{ key: string; value: string }>): Promise<void>;
}

/**
 * 字典仓储接口
 */
export interface DictionaryRepository {
  /**
   * 获取所有字典
   */
  findAll(): Promise<DictionaryItem[]>;

  /**
   * 根据编码获取字典
   */
  findByCode(code: string): Promise<DictionaryItem[]>;

  /**
   * 根据 ID 获取字典
   */
  findById(id: number): Promise<DictionaryItem | null>;

  /**
   * 创建字典
   */
  create(data: CreateDictionaryInput): Promise<DictionaryItem>;

  /**
   * 更新字典
   */
  update(id: number, data: UpdateDictionaryInput): Promise<DictionaryItem>;

  /**
   * 删除字典（软删除）
   */
  delete(id: number): Promise<void>;
}
