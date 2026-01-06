/**
 * 对象存储错误基类
 */
export class ObjectStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectStorageError';
  }
}

/**
 * 配置错误
 */
export class ObjectStorageConfigError extends ObjectStorageError {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectStorageConfigError';
  }
}

/**
 * 签名验证错误
 */
export class ObjectStorageSignatureError extends ObjectStorageError {
  constructor(message: string = 'Invalid signature') {
    super(message);
    this.name = 'ObjectStorageSignatureError';
  }
}

/**
 * 对象不存在错误
 */
export class ObjectNotFoundError extends ObjectStorageError {
  constructor(key: string, bucket?: string) {
    super(`Object not found: ${bucket ? `${bucket}/` : ''}${key}`);
    this.name = 'ObjectNotFoundError';
  }
}

/**
 * 厂商错误（透传原始错误）
 */
export class ObjectStorageProviderError extends ObjectStorageError {
  public readonly provider: string;
  public readonly originalError: unknown;

  constructor(provider: string, originalError: unknown, message?: string) {
    const errorMessage = message || (originalError instanceof Error ? originalError.message : String(originalError));
    super(`[${provider}] ${errorMessage}`);
    this.name = 'ObjectStorageProviderError';
    this.provider = provider;
    this.originalError = originalError;
  }
}
