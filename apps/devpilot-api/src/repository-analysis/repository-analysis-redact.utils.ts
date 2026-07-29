import {
  REPOSITORY_SECRET_ENV_PATTERN,
  REPOSITORY_SECRET_KEY_PATTERN,
} from './repository-analysis.constants';

const TOKEN_LIKE = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{10,}|Bearer\s+\S+)\b/gi;
const PRIVATE_KEY = /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g;
const URL_USERINFO = /([a-z][a-z\d+.-]*:\/\/)[^/@\s]+@/gi;
const ENV_ASSIGNMENT =
  /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("[^"\r\n]*"|'[^'\r\n]*'|[^\s;&|]+)/g;
const SECRET_CLI_OPTION =
  /(\s--?(?:password|token|secret|private[-_]?key|access[-_]?key|secret[-_]?key)(?:=|\s+))("[^"\r\n]*"|'[^'\r\n]*'|[^\s;&|]+)/gi;

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

function isEnvironmentReference(value: string): boolean {
  const normalized = value.replace(/^['"]|['"]$/g, '');
  return /^\$(?:\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)$/.test(normalized);
}
