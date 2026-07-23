/**
 * CDN 配置域工具函数
 *
 * 单一职责：无状态纯函数（TTL 人性化、凭证类型标签）。
 */

import { getProviderLabel, PROVIDERS, CREDENTIAL_TYPES } from './constants';

/**
 * 将秒级 TTL 人性化为本地化文案。
 *
 * @example
 *   formatTtl(30)      // '< 1 分钟' / '< 1 min'
 *   formatTtl(3600)    // '1 小时' / '1 hour(s)'
 *   formatTtl(86400)   // '1 天' / '1 day(s)'
 *
 * 注意：仅做数值化展示，文案由调用方决定 i18n key，本函数返回结构化片段。
 */
export function formatTtlBreakdown(seconds: number): {
  value: number;
  unit: 'second' | 'minute' | 'hour' | 'day';
} {
  if (!Number.isFinite(seconds) || seconds < 60) {
    return { value: Math.max(0, Math.floor(seconds || 0)), unit: 'second' };
  }
  if (seconds < 3600) {
    return { value: Math.round(seconds / 60), unit: 'minute' };
  }
  if (seconds < 86400) {
    return { value: Math.round(seconds / 3600), unit: 'hour' };
  }
  return { value: Math.round(seconds / 86400), unit: 'day' };
}

/**
 * 将凭证类型（如 `cdn_qiniu`）映射为与 PROVIDERS 一致的中文标签。
 * 优先查 CREDENTIAL_TYPES；回退用 provider 标签；最终回退原始值。
 */
export function getCredentialTypeLabel(type: string): string {
  const hit = CREDENTIAL_TYPES.find((c) => c.value === type);
  if (hit) return hit.label;
  const provider = type.replace(/^cdn_/, '');
  if (PROVIDERS.some((p) => p.value === provider)) return getProviderLabel(provider);
  return type;
}
