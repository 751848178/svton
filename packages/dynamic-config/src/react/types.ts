import type { ConfigItem, DictionaryItem, ConfigValueType } from '../core/types';

/**
 * API 客户端接口
 * 用户需要实现此接口来对接自己的 API 层
 */
export interface ConfigApiClient {
  /** 获取公开配置 */
  getPublicConfigs(): Promise<Record<string, any>>;

  /** 获取系统配置 */
  getSystemConfig(): Promise<Record<string, any>>;

  /** 获取分类配置 */
  getByCategory(category: string): Promise<ConfigItem[]>;

  /** 获取单个配置 */
  get(key: string): Promise<any>;

  /** 设置配置 */
  set(key: string, value: any): Promise<void>;

  /** 批量更新配置 */
  batchUpdate(configs: Array<{ key: string; value: any }>): Promise<void>;

  /** 删除配置 */
  delete(key: string): Promise<void>;

  /** 重新加载配置 */
  reload(): Promise<void>;
}

export interface DictionaryApiClient {
  /** 获取所有字典 */
  findAll(): Promise<DictionaryItem[]>;

  /** 根据编码获取字典 */
  findByCode(code: string): Promise<DictionaryItem[]>;

  /** 获取字典树 */
  getTree(code: string): Promise<DictionaryItem[]>;

  /** 创建字典 */
  create(data: any): Promise<DictionaryItem>;

  /** 更新字典 */
  update(id: number, data: any): Promise<DictionaryItem>;

  /** 删除字典 */
  delete(id: number): Promise<void>;
}

/**
 * 配置表单字段渲染器 Props（基础）
 */
export interface BaseConfigFieldProps {
  config: ConfigItem;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

/**
 * 字典选择器 Props（基础）
 */
export interface BaseDictionarySelectProps {
  code: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 配置分类
 */
export interface ConfigCategory {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Provider Props
 */
export interface DynamicConfigProviderProps {
  configApi: ConfigApiClient;
  dictionaryApi: DictionaryApiClient;
  children: React.ReactNode;
}
