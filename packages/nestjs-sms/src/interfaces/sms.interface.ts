/**
 * 短信发送输入
 */
export interface SendSmsInput {
  /** 手机号（支持单个或多个） */
  phone: string | string[];
  /** 模板 ID */
  templateId: string;
  /** 模板参数 */
  params?: Record<string, string>;
  /** 签名（可选，使用默认签名时不传） */
  signName?: string;
}

/**
 * 短信发送输出
 */
export interface SendSmsOutput {
  /** 是否成功 */
  success: boolean;
  /** 消息 ID（厂商返回） */
  messageId?: string;
  /** 错误码 */
  code?: string;
  /** 错误消息 */
  message?: string;
  /** 原始响应 */
  raw?: unknown;
}

/**
 * 短信客户端接口
 */
export interface SmsClient {
  /**
   * 发送短信
   */
  send(input: SendSmsInput): Promise<SendSmsOutput>;
}

/**
 * 短信适配器接口
 */
export interface SmsAdapter {
  /** 适配器名称 */
  readonly name: string;

  /** 创建客户端实例 */
  createClient(): SmsClient | Promise<SmsClient>;
}

/** 适配器工厂函数类型 */
export type SmsAdapterFactory = () => SmsAdapter | Promise<SmsAdapter>;
