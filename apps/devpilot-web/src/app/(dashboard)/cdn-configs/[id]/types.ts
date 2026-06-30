/**
 * CDN 配置详情域类型
 *
 * 单一职责：仅声明接口。
 */

export interface CDNConfig {
  id: string;
  name: string;
  domain: string;
  origin: string;
  provider: 'qiniu' | 'aliyun' | 'cloudflare' | string;
  cacheRules: Array<{ path: string; ttl: number }>;
  project?: { id: string; name: string };
  credential?: { id: string; name: string };
  createdBy?: { id: string; name: string | null; email: string };
  createdAt: string;
  updatedAt: string;
}
