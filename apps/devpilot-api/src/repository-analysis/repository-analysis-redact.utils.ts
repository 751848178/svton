import {
  REPOSITORY_SECRET_ENV_PATTERN,
  REPOSITORY_SECRET_KEY_PATTERN,
} from './repository-analysis.constants';

const TOKEN_LIKE = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{10,}|npm_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+\S+)\b/gi;
const PRIVATE_KEY = /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g;
const URL_USERINFO = /([a-z][a-z\d+.-]*:\/\/)[^/@\s]+@/gi;
const ENV_ASSIGNMENT =
  /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("[^"\r\n]*"|'[^'\r\n]*'|[^\s;&|]+)/g;
const SECRET_CLI_OPTION =
  /(\s--?(?:password|token|secret|private[-_]?key|access[-_]?key|secret[-_]?key)(?:=|\s+))("[^"\r\n]*"|'[^'\r\n]*'|[^\s;&|]+)/gi;
const STRUCTURED_ASSIGNMENT =
  /(?:^|[,{]|\n)\s*["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*:\s*("[^"\r\n]+"|'[^'\r\n]+'|[^\s#[{][^,\r\n}]*)/g;

export function redactRepositoryText(value: string, secrets: string[] = []): string {
  let redacted = value
    .replace(PRIVATE_KEY, '[REDACTED_PRIVATE_KEY]')
    .replace(TOKEN_LIKE, '[REDACTED_TOKEN]')
    .replace(URL_USERINFO, '$1[REDACTED]@')
    .replace(ENV_ASSIGNMENT, (match, key: string, assigned: string) =>
      !isSecretEnvironmentName(key) || isEnvironmentReference(assigned)
        ? match
        : `${key}=[REDACTED]`)
    .replace(SECRET_CLI_OPTION, (match, prefix: string, assigned: string) =>
      isEnvironmentReference(assigned) ? match : `${prefix}[REDACTED]`);
  for (const secret of secrets.filter(Boolean)) {
    redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted.slice(0, 4_000);
}

export function redactRepositoryValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactRepositoryValue);
  if (value instanceof Date) return value;
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? redactRepositoryText(value) : value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      REPOSITORY_SECRET_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : redactRepositoryValue(nested),
    ]),
  );
}

export function isSecretEnvironmentName(name: string): boolean {
  return REPOSITORY_SECRET_ENV_PATTERN.test(name);
}

export function containsRepositorySecretText(value: string): boolean {
  if (/-----BEGIN [^-]*PRIVATE KEY-----|-----END [^-]*PRIVATE KEY-----/.test(value))
    return true;
  const windowSize = 4_000;
  const overlap = 1_000;
  for (let offset = 0; offset < value.length; offset += windowSize - overlap) {
    const window = value.slice(offset, offset + windowSize);
    if (redactRepositoryText(window) !== window) return true;
  }
  return false;
}

export function containsRepositoryStructuredSecretText(value: string): boolean {
  for (const match of value.matchAll(STRUCTURED_ASSIGNMENT)) {
    if (
      !REPOSITORY_SECRET_KEY_PATTERN.test(String(match[1])) &&
      !isSecretEnvironmentName(String(match[1]))
    )
      continue;
    const assigned = String(match[2] || '').trim();
    const normalized = assigned.replace(/^['"]|['"]$/g, '').trim();
    if (
      normalized &&
      !isEnvironmentReference(assigned) &&
      !/^\[?REDACTED\]?$|^<[^>]+>$/.test(normalized)
    )
      return true;
  }
  return false;
}

function isEnvironmentReference(value: string): boolean {
  const normalized = value.replace(/^['"]|['"]$/g, '');
  return /^\$(?:\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)$/.test(normalized);
}
