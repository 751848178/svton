import { z } from 'zod';

/**
 * 环境变量 Schema
 * 使用 @svton/nestjs-config-schema 进行验证
 */
export const envSchema = z.object({
  // 应用配置
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // 数据库
  DATABASE_URL: z.string().url(),

  // Redis（可选）
  REDIS_URL: z.string().url().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // 七牛云对象存储（可选）
  QINIU_ACCESS_KEY: z.string().optional(),
  QINIU_SECRET_KEY: z.string().optional(),
  QINIU_BUCKET: z.string().optional(),
  QINIU_REGION: z.string().optional(),
  QINIU_CDN_URL: z.string().url().optional(),

  // 阿里云短信（可选）
  ALIYUN_ACCESS_KEY_ID: z.string().optional(),
  ALIYUN_ACCESS_KEY_SECRET: z.string().optional(),
  SMS_SIGN_NAME: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
