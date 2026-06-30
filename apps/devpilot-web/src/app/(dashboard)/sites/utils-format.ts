/** 站点域工具 - TLS/状态/运行时格式化与标签（纯函数）。 */

import type { SiteRuntimeType } from './types';
import {
  readRecord,
  readString,
  readNumber,
  readBoolean,
  readStringArray,
  readRecordArray,
} from './utils';

export function formatTlsAssetLabel(asset: Record<string, unknown>) {
  const issuer = readString(asset.issuer);
  const expiresAt = readString(asset.expiresAt) || readString(asset.notAfter);
  const fingerprint = readString(asset.fingerprintSha256);
  const id = readString(asset.id);
  const parts = [
    issuer,
    expiresAt ? `${formatDateTime(expiresAt)} 到期` : '',
    fingerprint ? formatShortFingerprint(fingerprint) : '',
  ].filter(Boolean);

  return parts.join(' · ') || id || '未命名证书资产';
}

export function formatTlsCertificateSummary(tls: Record<string, unknown>) {
  const certificate = readRecord(tls.certificate);
  const assets = readRecordArray(tls.assets);
  const currentCertificateAssetId = readString(tls.currentCertificateAssetId);
  const currentAsset =
    assets.find((asset) => readString(asset.id) === currentCertificateAssetId) || assets[0] || {};
  const expiresAt =
    readString(tls.expiresAt) ||
    readString(tls.notAfter) ||
    readString(tls.certificateExpiresAt) ||
    readString(certificate.expiresAt) ||
    readString(certificate.notAfter);
  const lastProbedAt =
    readString(tls.lastProbedAt) || readString(tls.probedAt) || readString(certificate.probedAt);
  const issuer = readString(tls.issuer) || readString(certificate.issuer);
  const daysRemaining = readNumber(tls.daysRemaining) ?? readNumber(certificate.daysRemaining);
  const fingerprint =
    readString(tls.fingerprintSha256) ||
    readString(certificate.fingerprintSha256) ||
    readString(currentAsset.fingerprintSha256);
  const parts: string[] = [];

  if (expiresAt) {
    parts.push(`${formatDateTime(expiresAt)} 到期`);
  }
  if (daysRemaining !== undefined) {
    parts.push(
      daysRemaining >= 0 ? `剩余 ${daysRemaining} 天` : `已过期 ${Math.abs(daysRemaining)} 天`,
    );
  }
  if (issuer) {
    parts.push(`签发方 ${issuer}`);
  }
  if (lastProbedAt) {
    parts.push(`最近探测 ${formatDateTime(lastProbedAt)}`);
  }
  if (assets.length > 0) {
    parts.push(`资产 ${assets.length} 个`);
  }
  if (fingerprint) {
    parts.push(`指纹 ${formatShortFingerprint(fingerprint)}`);
  }

  return parts.join(' · ');
}

export function formatShortFingerprint(value: string) {
  const compact = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (compact.length <= 12) return value;
  return `${compact.slice(0, 6)}...${compact.slice(-6)}`;
}

export function formatTlsRenewalSummary(tls: Record<string, unknown>) {
  const renewal = readRecord(tls.renewal);
  const status = readString(tls.lastRenewalStatus) || readString(renewal.status);
  if (!status) return '';

  const followUpProbe = readRecord(renewal.followUpProbe);
  const checkedAt = readString(tls.lastRenewalCheckedAt) || readString(renewal.checkedAt);
  const dryRun = readBoolean(renewal.dryRun);
  const summary = readString(tls.lastRenewalSummary) || readString(renewal.summary);
  const followUpStatus =
    readString(tls.lastRenewalFollowUpProbeStatus) || readString(followUpProbe.status);
  const parts = [getTlsRenewalStatusLabel(status), dryRun ? '演练' : '正式续期'];

  if (checkedAt) {
    parts.push(formatDateTime(checkedAt));
  }
  if (summary) {
    parts.push(summary);
  }
  if (followUpStatus) {
    parts.push(`续期后探测${getTlsFollowUpProbeStatusLabel(followUpStatus)}`);
  }

  return parts.join(' · ');
}

export function getTlsRenewalStatusLabel(status: string) {
  if (status === 'succeeded') return '成功';
  if (status === 'not_due') return '未到续期窗口';
  if (status === 'failed') return '失败';
  if (status === 'unknown') return '结果未知';
  return status;
}

export function getTlsFollowUpProbeStatusLabel(status: string) {
  if (status === 'queued') return '已排队';
  if (status === 'failed') return '失败';
  return status;
}

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

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
