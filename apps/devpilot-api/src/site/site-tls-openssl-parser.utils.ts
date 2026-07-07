/**
 * Pure OpenSSL output parsing helpers for TLS probe metadata extraction.
 * Extracted from `site-tls-probe.ts` to bring it under the file-size ceiling.
 */

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

export function parseOpenSslDate(value?: string) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
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
