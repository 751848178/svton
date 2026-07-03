/** 站点域工具 - 状态、运行时与运行日志格式化（纯函数）。 */

import type { SiteRuntimeType } from './types';
import { readString } from './utils';

export { formatDateTime } from './date-format.utils';
export {
  formatTlsAssetLabel,
  formatTlsCertificateSummary,
  formatShortFingerprint,
  formatTlsRenewalSummary,
  getTlsRenewalStatusLabel,
  getTlsFollowUpProbeStatusLabel,
} from './tls-format.utils';

export function describeRuntime(
  runtimeType: SiteRuntimeType,
  runtimeConfig: Record<string, unknown>,
) {
  if (runtimeType === 'static') {
    return readString(runtimeConfig.rootPath) || '未配置静态目录';
  }

  return (
    readString(runtimeConfig.upstreamUrl) ||
    [readString(runtimeConfig.containerName), readString(runtimeConfig.containerPort)]
      .filter(Boolean)
      .join(':') ||
    '未配置上游'
  );
}

export function getStatusLabel(status: string) {
  if (status === 'active') return '已生效';
  if (status === 'queued') return '排队中';
  if (status === 'pending') return '待同步';
  if (status === 'error') return '错误';
  if (status === 'draft') return '草稿';
  if (status === 'completed') return '完成';
  if (status === 'blocked') return '已阻止';
  if (status === 'failed') return '失败';
  if (status === 'approved') return '已批准';
  if (status === 'rejected') return '已拒绝';
  return status;
}

export function getRunModeLabel(mode: string) {
  if (mode === 'tls_renew') return 'TLS 续期';
  if (mode === 'tls_probe') return 'TLS 探测';
  if (mode === 'smoke_check') return 'Smoke 检查';
  if (mode === 'openresty_module_baseline') return '模块基线';
  if (mode === 'openresty_modules') return 'OpenResty 模块';
  if (mode === 'openresty_status') return 'OpenResty 状态';
  if (mode === 'diagnostics') return '诊断';
  if (mode === 'rollback') return '回滚';
  if (mode === 'sync') return '同步';
  return mode;
}

export function formatRunLogPreview(value: unknown) {
  const messages = readLogMessages(value);
  if (messages.length === 0) {
    return '';
  }
  return messages.slice(0, 6).join('\n');
}

export function readLogMessages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!item || typeof item !== 'object') return '';
      const record = item as Record<string, unknown>;
      const stream = typeof record.stream === 'string' ? `[${record.stream}] ` : '';
      const level = typeof record.level === 'string' ? `${record.level}: ` : '';
      const message = typeof record.message === 'string' ? record.message : '';
      return `${stream}${level}${message}`.trim();
    })
    .filter(Boolean);
}

export function getStatusClass(status: string) {
  if (status === 'queued') return 'bg-indigo-100 text-indigo-700';
  if (status === 'active' || status === 'completed' || status === 'approved')
    return 'bg-green-100 text-green-700';
  if (status === 'error' || status === 'failed' || status === 'rejected')
    return 'bg-red-100 text-red-700';
  if (status === 'pending' || status === 'blocked') return 'bg-yellow-100 text-yellow-700';
  return 'bg-muted text-muted-foreground';
}
