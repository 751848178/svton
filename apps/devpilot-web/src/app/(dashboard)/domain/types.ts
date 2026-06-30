/**
 * 域名配置域类型
 *
 * 单一职责：仅声明类型。
 */

export type SSLMode = 'none' | 'letsencrypt' | 'custom';

export interface DomainConfig {
  domain: string;
  upstream: string;
  upstreamPort: number;
  sslMode: SSLMode;
  enableGzip: boolean;
  enableWebSocket: boolean;
  clientMaxBodySize: number;
}

export const DEFAULT_DOMAIN_CONFIG: DomainConfig = {
  domain: '',
  upstream: 'http://localhost',
  upstreamPort: 3000,
  sslMode: 'none',
  enableGzip: true,
  enableWebSocket: false,
  clientMaxBodySize: 10,
};
