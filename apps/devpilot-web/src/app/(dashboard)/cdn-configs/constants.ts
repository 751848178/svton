/**
 * CDN 配置域常量
 *
 * 单一职责：仅放提供商选项与凭证类型映射。
 */

export const PROVIDERS = [
  { value: 'qiniu', label: '七牛云', icon: '🌐' },
  { value: 'aliyun', label: '阿里云', icon: '☁️' },
  { value: 'cloudflare', label: 'Cloudflare', icon: '🛡️' },
];

export const CREDENTIAL_TYPES = [
  { value: 'cdn_qiniu', label: '七牛云' },
  { value: 'cdn_aliyun', label: '阿里云' },
  { value: 'cdn_cloudflare', label: 'Cloudflare' },
];

export function getProviderLabel(provider: string): string {
  return PROVIDERS.find((p) => p.value === provider)?.label || provider;
}

export function getProviderIcon(provider: string): string {
  return PROVIDERS.find((p) => p.value === provider)?.icon || '🌐';
}
