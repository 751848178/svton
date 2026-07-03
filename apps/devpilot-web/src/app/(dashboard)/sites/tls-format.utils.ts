/** 站点 TLS 资产、证书与续期摘要格式化纯工具。 */

import { readRecord, readString, readNumber, readBoolean, readRecordArray } from './utils';
import { formatDateTime } from './date-format.utils';

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
