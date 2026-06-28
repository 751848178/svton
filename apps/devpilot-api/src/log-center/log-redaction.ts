export type LogRedactionPolicy = {
  extraKeys: string[];
  maskEmails: boolean;
  maskIpAddresses: boolean;
};

const DEFAULT_KEY_VALUE_PATTERN = /(password|passwd|pwd|secret|token|access[_-]?key|authorization)=([^\s]+)/gi;
const DEFAULT_BEARER_PATTERN = /(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const IPV4_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const DEFAULT_SENSITIVE_KEY_PARTS = ['password', 'passwd', 'pwd', 'secret', 'token', 'accesskey', 'authorization'];

export function resolveLogRedactionPolicy(metadata: unknown): LogRedactionPolicy {
  const record = asRecord(metadata);
  const redaction = asRecord(record.redaction);

  return {
    extraKeys: readStringArray(redaction.extraKeys || redaction.keys).slice(0, 30),
    maskEmails: redaction.maskEmails === true,
    maskIpAddresses: redaction.maskIpAddresses === true,
  };
}

export function redactLogMessage(message: string, policy: LogRedactionPolicy = resolveLogRedactionPolicy(undefined)) {
  let redacted = message
    .replace(DEFAULT_KEY_VALUE_PATTERN, '$1=[redacted]')
    .replace(DEFAULT_BEARER_PATTERN, '$1[redacted]');

  const extraPattern = buildExtraKeyPattern(policy.extraKeys);
  if (extraPattern) {
    redacted = redacted.replace(extraPattern, '$1=[redacted]');
  }
  if (policy.maskEmails) {
    redacted = redacted.replace(EMAIL_PATTERN, '[redacted-email]');
  }
  if (policy.maskIpAddresses) {
    redacted = redacted.replace(IPV4_PATTERN, '[redacted-ip]');
  }

  return redacted;
}

export function redactLogValue(value: unknown, policy: LogRedactionPolicy): unknown {
  if (typeof value === 'string') {
    return redactLogMessage(value, policy);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, policy));
  }
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    isSensitiveKey(key, policy.extraKeys) ? '[redacted]' : redactLogValue(item, policy),
  ]));
}

function buildExtraKeyPattern(keys: string[]) {
  const sanitized = keys
    .map((key) => key.trim())
    .filter((key) => /^[a-zA-Z0-9_.:-]{1,64}$/.test(key));
  if (sanitized.length === 0) return null;
  return new RegExp(`(${sanitized.map(escapeRegExp).join('|')})=([^\\s]+)`, 'gi');
}

function isSensitiveKey(key: string, extraKeys: string[]) {
  const normalized = normalizeKey(key);
  return DEFAULT_SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
    || extraKeys.some((extraKey) => {
      const extra = normalizeKey(extraKey);
      return Boolean(extra) && normalized.includes(extra);
    });
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readStringArray(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return values
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item && /^[a-zA-Z0-9_.:-]{1,64}$/.test(item));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
