/**
 * CDN 域常量
 *
 * 单一职责：仅放提供商选项与默认配置。
 */

import type { CDNConfig, ProviderOption } from './types';

export const PROVIDERS: ProviderOption[] = [
  { value: 'qiniu', label: '七牛云', icon: '🌐' },
  { value: 'aliyun', label: '阿里云 CDN', icon: '☁️' },
  { value: 'tencent', label: '腾讯云 CDN', icon: '🔷' },
  { value: 'cloudflare', label: 'Cloudflare', icon: '🛡️' },
];

export const DEFAULT_CDN_CONFIG: CDNConfig = {
  provider: 'qiniu',
  domain: '',
  originDomain: '',
  originPath: '/',
  enableHttps: true,
  enableCompression: true,
};
