/**
 * CDN 配置域类型
 *
 * 单一职责：仅声明接口。
 */

export type CDNProvider = 'qiniu' | 'aliyun' | 'tencent' | 'cloudflare';

export interface CDNConfig {
  provider: CDNProvider;
  domain: string;
  originDomain: string;
  originPath: string;
  enableHttps: boolean;
  enableCompression: boolean;
}

export interface CDNResults {
  urlConfig?: Record<string, string>;
  frontendConfig?: string;
  refreshScript?: string;
  nextjsConfig?: string;
  envConfig?: string;
}

export interface ProviderOption {
  value: CDNProvider;
  label: string;
}
