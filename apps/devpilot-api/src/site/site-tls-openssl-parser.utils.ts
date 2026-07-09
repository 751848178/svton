/**
 * Pure OpenSSL output parsing helpers for TLS probe metadata extraction.
 * Extracted from `site-tls-probe.ts` to bring it under the file-size ceiling.
 */

import * as crypto from 'crypto';

type JsonRecord = Record<string, unknown>;

export function parseOpenSslCertificateText(text: string) {
  const result: {
    subject?: string;
    issuer?: string;
    serialNumber?: string;
    notBefore?: string;
    notAfter?: string;
    fingerprintSha256?: string;
  } = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim().toLowerCase();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!value) continue;

    if (key === 'subject') result.subject = value;
    if (key === 'issuer') result.issuer = value;
    if (key === 'serial') result.serialNumber = value;
    if (key === 'notbefore') result.notBefore = value;
    if (key === 'notafter') result.notAfter = value;
    if (key === 'sha256 fingerprint') result.fingerprintSha256 = value;
  }

  return result;
}

/** openssl 英文月份缩写 → 数字（0-based）。LC_ALL=C 下 openssl 始终输出英文月份。 */
const OPENSSL_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * 解析 openssl x509 -dates 的时间字符串（如 `Jul  8 12:00:00 2026 GMT`）。
 *
 * 历史上用 `new Date(normalized)` 直接解析，但这依赖 V8 的 locale 行为，
 * 非 C locale（如中文 `9月`）会产出 Invalid Date。改为显式解析英文月份格式，
 * 匹配失败再回退 `new Date()`（保留对非标准格式的尽力解析）。
 */
export function parseOpenSslDate(value?: string): Date | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();

  // 显式匹配 "Mon DD HH:MM:SS YYYY GMT"（openssl 默认 LC_ALL=C 输出格式）
  const match = normalized.match(
    /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})\s*(?:GMT|UTC)?$/i,
  );
  if (match) {
    const month = OPENSSL_MONTHS[match[1].toLowerCase()];
    if (month !== undefined) {
      const day = parseInt(match[2], 10);
      const hour = parseInt(match[3], 10);
      const minute = parseInt(match[4], 10);
      const second = parseInt(match[5], 10);
      const year = parseInt(match[6], 10);
      // 用 UTC 构造（openssl 时间总是 GMT），避免本地时区偏移
      const date = new Date(Date.UTC(year, month, day, hour, minute, second));
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  // 回退：尽力用 Date 解析（覆盖非英文 locale 或已带时区的 ISO 串）
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 从文本块中提取并解析 PEM 证书（优先路径）。
 *
 * 使用 node:crypto 的 X509Certificate（Node 15.6+），直接从证书字节提取结构化字段，
 * 不依赖 openssl 文本输出的 locale/格式。若文本不含完整 PEM 或 PEM 被截断，返回 null
 * （调用方应回退到 `parseOpenSslCertificateText` 文本解析）。
 */
export function parseX509FromPem(text: string): {
  subject?: string;
  issuer?: string;
  serialNumber?: string;
  notBefore?: string;
  notAfter?: string;
  fingerprintSha256?: string;
} | null {
  const pemMatch = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (!pemMatch) return null;

  try {
    const cert = new crypto.X509Certificate(Buffer.from(pemMatch[0], 'utf8'));
    // @types/node 旧版只有 validFrom/validTo（字符串 ISO 格式）；
    // 新版 Node（16.15+/18+）还有 validFromDate/validToDate（Date 对象）。优先用 Date 版本（若存在）。
    const certAny = cert as crypto.X509Certificate & {
      validFromDate?: Date | string;
      validToDate?: Date | string;
    };
    const notBefore = certAny.validFromDate ?? cert.validFrom;
    const notAfter = certAny.validToDate ?? cert.validTo;
    return {
      subject: cert.subject,
      issuer: cert.issuer,
      serialNumber: cert.serialNumber,
      notBefore: notBefore instanceof Date ? notBefore.toUTCString() : String(notBefore),
      notAfter: notAfter instanceof Date ? notAfter.toUTCString() : String(notAfter),
      fingerprintSha256: cert.fingerprint256,
    };
  } catch {
    return null;
  }
}

export function collectText(value: unknown, target: string[]) {
  if (typeof value === 'string') {
    target.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, target));
    return;
  }
  if (!isRecord(value)) {
    return;
  }

  for (const key of ['stdoutPreview', 'stdout', 'message', 'output', 'stderrPreview', 'stderr']) {
    const item = value[key];
    if (typeof item === 'string') {
      target.push(item);
    }
  }

  for (const key of ['logs', 'result', 'results', 'commandResults', 'steps']) {
    collectText(value[key], target);
  }
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
