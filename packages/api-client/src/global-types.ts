/**
 * 全局类型扩展点
 * 
 * @svton/api-client 定义空的接口，供 @svton/types 扩展
 * 通过 TypeScript 模块增强（Module Augmentation）机制实现类型注入
 */

/**
 * API 定义格式
 */
export interface ApiDefinition<TParams = void, TResponse = any> {
  params: TParams;
  response: TResponse;
}

/**
 * 全局 API Registry 接口（空接口，供扩展）
 * 
 * @svton/types 包会通过 declare module 扩展此接口
 * 
 * @example
 * ```typescript
 * // 在 @svton/types 中扩展
 * declare module '@svton/api-client' {
 *   interface GlobalApiRegistry {
 *     'GET:/contents': ApiDefinition<ContentQueryDto, ContentListVo>;
 *   }
 * }
 * ```
 */
export interface GlobalApiRegistry {
  // 空接口，由 @svton/types 扩展
}

/**
 * API 名称类型
 */
export type ApiName = keyof GlobalApiRegistry;

/**
 * 提取 API 参数类型
 */
export type ApiParams<T extends ApiName> = GlobalApiRegistry[T] extends ApiDefinition<infer P, any> ? P : never;

/**
 * 提取 API 响应类型
 */
export type ApiResponse<T extends ApiName> = GlobalApiRegistry[T] extends ApiDefinition<any, infer R> ? R : never;
