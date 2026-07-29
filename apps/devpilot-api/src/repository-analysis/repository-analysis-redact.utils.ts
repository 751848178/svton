import {
  REPOSITORY_SECRET_ENV_PATTERN,
  REPOSITORY_SECRET_KEY_PATTERN,
} from './repository-analysis.constants';

const TOKEN_LIKE = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{10,}|Bearer\s+\S+)\b/gi;
const PRIVATE_KEY = /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g;
const URL_USERINFO = /(https?:\/\/)[^/@\s]+@/gi;

export function redactRepositoryText(value: string, secrets: string[] = []): string {
  let redacted = value
    .replace(PRIVATE_KEY, '[REDACTED_PRIVATE_KEY]')
    .replace(TOKEN_LIKE, '[REDACTED_TOKEN]')
    .replace(URL_USERINFO, '$1[REDACTED]@');
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
