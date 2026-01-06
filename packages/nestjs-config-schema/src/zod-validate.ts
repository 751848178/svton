import type { ZodSchema, ZodError } from 'zod';

export interface ZodValidateOptions {
  /** 是否在验证失败时抛出错误（默认 true） */
  throwOnError?: boolean;
  /** 自定义错误格式化函数 */
  formatError?: (error: ZodError) => string;
}

/**
 * 配置验证错误
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * 创建 Zod 验证函数
 * 用于 @nestjs/config 的 validate 选项
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { createZodValidate } from '@svton/nestjs-config-schema';
 *
 * const envSchema = z.object({
 *   NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
 *   PORT: z.coerce.number().default(3000),
 *   DATABASE_URL: z.string().url(),
 *   REDIS_URL: z.string().url().optional(),
 * });
 *
 * // 在 ConfigModule 中使用
 * ConfigModule.forRoot({
 *   validate: createZodValidate(envSchema),
 * });
 * ```
 */
export function createZodValidate<T>(
  schema: ZodSchema<T>,
  options: ZodValidateOptions = {},
): (config: Record<string, unknown>) => T {
  const { throwOnError = true, formatError } = options;

  return (config: Record<string, unknown>): T => {
    const result = schema.safeParse(config);

    if (result.success) {
      return result.data;
    }

    const errors = result.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));

    const errorMessage =
      formatError?.(result.error) ||
      `Config validation failed:\n${errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n')}`;

    if (throwOnError) {
      throw new ConfigValidationError(errorMessage, errors);
    }

    // 如果不抛出错误，返回原始配置（类型不安全，但允许继续运行）
    console.error(errorMessage);
    return config as T;
  };
}
