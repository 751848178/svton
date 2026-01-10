/**
 * 动态配置系统 - 核心类型定义
 */

/**
 * 配置值类型
 */
export type ConfigValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'array'
  | 'password'
  | 'enum';

/**
 * 配置项
 */
export interface ConfigItem {
  id: number;
  key: string;
  value: string;
  type: ConfigValueType;
  category: string;
  label: string;
  description?: string | null;
  isPublic: boolean;
  isRequired: boolean;
  defaultValue?: string | null;
  options?: string | null;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建配置项参数
 */
export interface CreateConfigInput {
  key: string;
  value: string;
  type: ConfigValueType;
  category: string;
  label: string;
  description?: string;
  isPublic?: boolean;
  isRequired?: boolean;
  defaultValue?: string;
  options?: string;
  sort?: number;
}

/**
 * 更新配置项参数
 */
export interface UpdateConfigInput {
  value?: string;
  label?: string;
  description?: string;
  isPublic?: boolean;
  isRequired?: boolean;
  defaultValue?: string;
  options?: string;
  sort?: number;
}

/**
 * 字典项
 */
export interface DictionaryItem {
  id: number;
  code: string;
  parentId?: number | null;
  label: string;
  value: string;
  type: 'enum' | 'tree' | 'list';
  sort: number;
  isEnabled: boolean;
  description?: string | null;
  extra?: string | null;
  createdAt: Date;
  updatedAt: Date;
  children?: DictionaryItem[];
}

/**
 * 创建字典项参数
 */
export interface CreateDictionaryInput {
  code: string;
  label: string;
  value: string;
  type: 'enum' | 'tree' | 'list';
  parentId?: number;
  sort?: number;
  description?: string;
  extra?: string;
}

/**
 * 更新字典项参数
 */
export interface UpdateDictionaryInput {
  label?: string;
  value?: string;
  type?: 'enum' | 'tree' | 'list';
  parentId?: number;
  sort?: number;
  isEnabled?: boolean;
  description?: string;
  extra?: string;
}

/**
 * 批量更新配置参数
 */
export interface BatchUpdateConfig {
  key: string;
  value: any;
}
