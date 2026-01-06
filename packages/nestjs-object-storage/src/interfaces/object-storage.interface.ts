/**
 * 对象存储核心接口定义
 */

/** 预签名方法类型 */
export type PresignMethod = 'GET' | 'PUT';

/** 上传对象输入 */
export interface PutObjectInput {
  bucket?: string;
  key: string;
  body: Buffer | NodeJS.ReadableStream;
  contentType?: string;
  metadata?: Record<string, string>;
}

/** 上传对象输出 */
export interface PutObjectOutput {
  key: string;
  etag?: string;
  url?: string;
}

/** 删除对象输入 */
export interface DeleteObjectInput {
  bucket?: string;
  key: string;
}

/** 获取公开 URL 输入 */
export interface GetPublicUrlInput {
  bucket?: string;
  key: string;
}

/** 预签名输入 */
export interface PresignInput {
  bucket?: string;
  key: string;
  method: PresignMethod;
  expiresIn?: number;
  contentType?: string;
  /** 回调配置（部分厂商支持） */
  callback?: PresignCallbackConfig;
}

/** 预签名回调配置 */
export interface PresignCallbackConfig {
  /** 回调 URL */
  url: string;
  /** 回调请求体（模板变量） */
  body?: string;
  /** 回调请求体类型 */
  bodyType?: 'application/json' | 'application/x-www-form-urlencoded';
  /** 自定义回调参数 */
  customVars?: Record<string, string>;
}

/** 预签名输出 */
export interface PresignOutput {
  url: string;
  method: PresignMethod;
  headers?: Record<string, string>;
  /** POST policy 表单字段（部分厂商） */
  formFields?: Record<string, string>;
}

/** 回调验签输入 */
export interface VerifyCallbackInput {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[]>;
  rawBody: Buffer;
  ip?: string;
}

/** 回调验签输出 */
export interface VerifyCallbackOutput {
  isValid: boolean;
  provider: string;
  bucket?: string;
  key?: string;
  etag?: string;
  size?: number;
  eventType?: string;
  metadata?: Record<string, unknown>;
  raw: unknown;
}

/**
 * 对象存储客户端接口
 * 业务层只依赖此接口
 */
export interface ObjectStorageClient {
  /** 上传对象 */
  putObject(input: PutObjectInput): Promise<PutObjectOutput>;

  /** 删除对象 */
  deleteObject(input: DeleteObjectInput): Promise<void>;

  /** 获取公开访问 URL */
  getPublicUrl(input: GetPublicUrlInput): string;

  /** 生成预签名 URL */
  presign(input: PresignInput): Promise<PresignOutput>;

  /** 验证回调签名 */
  verifyCallback(input: VerifyCallbackInput): Promise<VerifyCallbackOutput>;
}

/**
 * 适配器接口
 * 各厂商 adapter 实现此接口
 */
export interface ObjectStorageAdapter {
  /** 适配器名称 */
  readonly name: string;

  /** 创建客户端实例 */
  createClient(): ObjectStorageClient | Promise<ObjectStorageClient>;
}

/** 适配器工厂函数类型 */
export type ObjectStorageAdapterFactory = () => ObjectStorageAdapter | Promise<ObjectStorageAdapter>;
