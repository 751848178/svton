import type {
  SecretLeakFinding,
  SecretLeakScannableRecord,
} from '../release-secret-leak-verification.types';

const REDACTED_OR_REFERENCE = /^(?:\[REDACTED\]|<redacted>|\$\{?[A-Z_][A-Z0-9_]*\}?|secret:\/\/)/i;
const SENSITIVE_KEY = /database_?url|password|secret|^jwt|authorization|token|api[_-]?key|private[_-]?key|credential/i;
const ENV_ASSIGNMENT = /-e\s+([A-Za-z_][A-Za-z0-9_]*)=(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;
const NON_SECRET_CANDIDATE = /^(?:true|false|null|none|undefined|yes|no|0|1)$/i;
const SAFE_POLICY_MARKERS = new Set([
  'masked_before_persisting',
  'must_mask_before_persisting',
]);
const DETECTORS = [
  ['dsn_with_credential', /[a-z][a-z0-9+.-]*:\/\/[^/\s:@"']+:[^/\s:@"']+@[^\s"']+/i],
  ['mysql_inline_password', /(?:^|\s)-p[^\s"'-][^\s"']*/],
  ['password_flag', /--password(?:=|\s+)[^\s"']+/i],
  ['redis_inline_password', /(?:^|\s)-a\s+[^\s"'-][^\s"']*/],
  ['authorization_value', /\b(?:authorization\s*[:=]\s*|bearer\s+)[a-z0-9._~+/=-]{8,}/i],
  ['private_key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
] as const;

export function scanSecretLeakRecords(
  records: SecretLeakScannableRecord[],
  candidateSecrets: string[] = [],
): SecretLeakFinding[] {
  const candidates = normalizeCandidateSecrets(candidateSecrets);
  return records.flatMap((record) => scanRecord(record, candidates));
}

/** 保留原始秘密字节，仅剔除布尔/空值等显然不是秘密的运行参数。 */
export function normalizeCandidateSecrets(values: string[] = []): string[] {
  return [...new Set(values.filter((value) => (
    value.length >= 4
    && !NON_SECRET_CANDIDATE.test(value)
    && !REDACTED_OR_REFERENCE.test(value)
  )))];
}

function scanRecord(
  record: SecretLeakScannableRecord,
  candidates: string[],
): SecretLeakFinding[] {
  const findings: SecretLeakFinding[] = [];
  Object.entries(record.fields).forEach(([field, value]) => {
    scanValue(record, field, value, field, candidates, findings);
  });
  return dedupeFindings(findings);
}

function scanValue(
  record: SecretLeakScannableRecord,
  field: string,
  value: unknown,
  path: string,
  candidates: string[],
  findings: SecretLeakFinding[],
): void {
  if (typeof value === 'string') {
    detectString(record, field, value, path, candidates, findings);
    scanSerializedJson(record, field, value, path, candidates, findings);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scanValue(record, field, item, `${path}[${index}]`, candidates, findings);
    });
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    const nestedPath = `${path}.${key}`;
    if (typeof nested === 'string' && SENSITIVE_KEY.test(key) && isPlainSecret(nested)) {
      findings.push(toFinding(record, field, nestedPath, 'sensitive_key_value'));
    }
    scanValue(record, field, nested, nestedPath, candidates, findings);
  });
}

function detectString(
  record: SecretLeakScannableRecord,
  field: string,
  value: string,
  path: string,
  candidates: string[],
  findings: SecretLeakFinding[],
): void {
  DETECTORS.forEach(([detector, pattern]) => {
    if (pattern.test(value)) findings.push(toFinding(record, field, path, detector));
  });
  if (candidates.some((candidate) => value.includes(candidate))) {
    findings.push(toFinding(record, field, path, 'candidate_secret'));
  }
  for (const match of value.matchAll(ENV_ASSIGNMENT)) {
    const envValue = match[2] ?? match[3] ?? match[4] ?? '';
    if (SENSITIVE_KEY.test(match[1]) && isPlainSecret(envValue)) {
      findings.push(toFinding(record, field, path, 'environment_secret_value'));
    }
  }
}

function scanSerializedJson(
  record: SecretLeakScannableRecord,
  field: string,
  value: string,
  path: string,
  candidates: string[],
  findings: SecretLeakFinding[],
): void {
  if (!/^\s*[\[{]/.test(value)) return;
  try {
    scanValue(record, field, JSON.parse(value), `${path}.$json`, candidates, findings);
  } catch {
    // 普通日志文本以 { 开头时不是错误，继续按文本规则结果处理。
  }
}

function isPlainSecret(value: string): boolean {
  return value.length > 0
    && !REDACTED_OR_REFERENCE.test(value)
    && !NON_SECRET_CANDIDATE.test(value)
    && !SAFE_POLICY_MARKERS.has(value);
}

function toFinding(
  record: SecretLeakScannableRecord,
  field: string,
  path: string,
  detector: string,
): SecretLeakFinding {
  return { recordType: record.recordType, recordId: record.recordId, field, path, detector };
}

function dedupeFindings(findings: SecretLeakFinding[]): SecretLeakFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.recordType}:${finding.recordId}:${finding.path}:${finding.detector}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
