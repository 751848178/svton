/**
 * 短信错误基类
 */
export class SmsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsError';
  }
}

/**
 * 配置错误
 */
export class SmsConfigError extends SmsError {
  constructor(message: string) {
    super(message);
    this.name = 'SmsConfigError';
  }
}

/**
 * 发送失败错误
 */
export class SmsSendError extends SmsError {
  public readonly code?: string;
  public readonly provider: string;

  constructor(provider: string, message: string, code?: string) {
    super(`[${provider}] ${message}`);
    this.name = 'SmsSendError';
    this.provider = provider;
    this.code = code;
  }
}

/**
 * 厂商错误（透传原始错误）
 */
export class SmsProviderError extends SmsError {
  public readonly provider: string;
  public readonly originalError: unknown;

  constructor(provider: string, originalError: unknown, message?: string) {
    const errorMessage = message || (originalError instanceof Error ? originalError.message : String(originalError));
    super(`[${provider}] ${errorMessage}`);
    this.name = 'SmsProviderError';
    this.provider = provider;
    this.originalError = originalError;
  }
}
