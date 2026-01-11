/**
 * 微信平台类型
 */
export type WechatPlatform = 'open' | 'mp' | 'miniprogram';

/**
 * 微信 Provider 配置
 */
export interface WechatProviderConfig {
  /** 平台类型 */
  platform: WechatPlatform;
  /** AppID */
  appId: string;
  /** AppSecret */
  appSecret: string;
  /** 回调地址 (open/mp 需要) */
  callbackUrl?: string;
  /** 授权作用域 */
  scope?: string;
}

/**
 * 微信 Access Token 响应
 */
export interface WechatAccessTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
}

/**
 * 微信用户信息
 */
export interface WechatUserInfo {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
}

/**
 * 小程序 code2session 响应
 */
export interface WechatMiniProgramSession {
  openid: string;
  session_key: string;
  unionid?: string;
}

/**
 * 小程序手机号响应
 */
export interface WechatPhoneInfo {
  phoneNumber: string;
  purePhoneNumber: string;
  countryCode: string;
  watermark: {
    timestamp: number;
    appid: string;
  };
}

/**
 * 微信 API 错误响应
 */
export interface WechatErrorResponse {
  errcode: number;
  errmsg: string;
}

/**
 * 统一的 OAuth 结果
 */
export interface OAuthResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
  };
}
