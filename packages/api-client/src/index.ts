/**
 * @svton/api-client
 * API 客户端框架
 * 
 * 提供 API 调用的核心功能和类型扩展点
 * 业务 API 类型定义在 @svton/types 包中
 */

// ========== 核心框架 ==========
export * from './define';
export * from './interceptors';

// ========== 全局类型扩展点 ==========
// 供 @svton/types 扩展的空接口和类型工具
export type {
  GlobalApiRegistry,
  ApiName,
  ApiParams,
  ApiResponse,
} from './global-types';

// ApiDefinition 需要同时作为类型和值导出以支持模块增强
export type { ApiDefinition } from './global-types';

// ========== API Registry ==========
// 注意：API Registry 现在通过 @svton/types 的模块增强实现
// 不再导出具体的 API_REGISTRY，保持框架包的纯净性

// ========== API Client ==========
export {
  createApiClient,
  type HttpAdapter,
} from './client';

// ========== 辅助类型 ==========
export * from './types';
