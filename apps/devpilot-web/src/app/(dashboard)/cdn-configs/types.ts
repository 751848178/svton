/**
 * CDN 配置域类型
 *
 * 单一职责：仅声明接口。
 */

export type CDNProvider = 'qiniu' | 'aliyun' | 'cloudflare' | string;

export interface CDNConfig {
  id: string;
  name: string;
  domain: string;
  origin: string;
  provider: CDNProvider;
  cacheRules: Array<{ path: string; ttl: number }>;
  project?: { id: string; name: string };
  createdAt: string;
}

export interface TeamCredential {
  id: string;
  type: string;
  name: string;
  createdAt: string;
}

export interface CDNConfigInput {
  name: string;
  domain: string;
  origin: string;
  provider: CDNProvider;
  credentialId: string;
}

export interface CredentialInput {
  name: string;
  type: string;
  accessKey: string;
  secretKey: string;
}
