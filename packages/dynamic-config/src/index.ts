/**
 * @svton/dynamic-config
 *
 * 动态配置管理系统
 *
 * 子模块:
 * - @svton/dynamic-config/core    - 核心逻辑（框架无关）
 * - @svton/dynamic-config/nestjs  - NestJS 集成
 * - @svton/dynamic-config/prisma  - Prisma 适配器
 * - @svton/dynamic-config/react   - React 组件和 Hooks
 */

// Re-export core types for convenience
export type {
  ConfigItem,
  ConfigValueType,
  CreateConfigInput,
  UpdateConfigInput,
  DictionaryItem,
  CreateDictionaryInput,
  UpdateDictionaryInput,
  BatchUpdateConfig,
} from './core/types';

// Re-export cache types
export type { CacheStrategy, CacheConfig, RedisClientInterface } from './core/cache/types';

// Re-export repository interfaces
export type { ConfigRepository, DictionaryRepository } from './core/repository';

// Version
export const VERSION = '0.1.0';
