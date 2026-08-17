import {
  REPOSITORY_SECRET_ENV_PATTERN,
  REPOSITORY_SECRET_KEY_PATTERN,
} from './repository-analysis.constants';

const TOKEN_LIKE = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{10,}|npm_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+\S+)\b/gi;
const STRONG_SECRET_TEXT = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{10,}|npm_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/i;
const COMPLETE_PRIVATE_KEY =
  /-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----\r?\n(?:[A-Za-z0-9+/=]{16,}\r?\n)+-----END \1-----/;
const PRIVATE_KEY = /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g;
const URL_USERINFO = /([a-z][a-z\d+.-]*:\/\/)[^/@\s]+@/gi;
const ENV_ASSIGNMENT =
  /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("[^"\r\n]*"|'[^'\r\n]*'|[^\s;&|]+)/g;
const SECRET_CLI_OPTION =
  /(\s--?(?:password|token|secret|private[-_]?key|access[-_]?key|secret[-_]?key)(?:=|\s+))("[^"\r\n]*"|'[^'\r\n]*'|[^\s;&|]+)/gi;
const STRUCTURED_ASSIGNMENT =
  /(?:^|[,{]|\n)\s*["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*:\s*("[^"\r\n]+"|'[^'\r\n]+'|[^\s#[{][^,\r\n}]*)/g;
const STRUCTURED_SECRET_ASSIGNMENT =
  /(^|[,{]\s*|\n\s*)(["']?)([A-Za-z_][A-Za-z0-9_.-]*)\2(\s*:\s*)("[^"\r\n]+"|'[^'\r\n]+'|\[[^\r\n]*\]|\{[^\r\n]*\}|[^\s#[{][^,\r\n}]*)/gim;

export function redactRepositoryText(
  value: string,
  secrets: string[] = [],
  maxLength = 4_000,
): string {
  let redacted = redactStructuredSecretBlocks(value)
    .replace(PRIVATE_KEY, '[REDACTED_PRIVATE_KEY]')
    .replace(TOKEN_LIKE, '[REDACTED_TOKEN]')
    .replace(URL_USERINFO, '$1[REDACTED]@')
    .replace(ENV_ASSIGNMENT, (match, key: string, assigned: string) =>
      !isSecretEnvironmentName(key) || isEnvironmentReference(assigned)
        ? match
        : `${key}=[REDACTED]`)
    .replace(SECRET_CLI_OPTION, (match, prefix: string, assigned: string) =>
      isEnvironmentReference(assigned) ? match : `${prefix}[REDACTED]`)
    .replace(
      STRUCTURED_SECRET_ASSIGNMENT,
      (match, prefix: string, quote: string, key: string, separator: string, assigned: string) =>
        !isSecretKey(key) || isEnvironmentReference(assigned)
          ? match
          : `${prefix}${quote}${key}${quote}${separator}[REDACTED]`,
    );
  for (const secret of secrets.filter(Boolean)) {
    redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted.slice(0, maxLength);
}

function redactStructuredSecretBlocks(value: string): string {
  const lines = value.split('\n');
  const redacted: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(
      /^([ \t]*(?:-\s*)?)(["']?)([A-Za-z_][A-Za-z0-9_.-]*)\2(\s*:\s*)(.*)$/,
    );
    const assigned = match?.[5]?.trim() || '';
    if (!match || !isSecretKey(match[3]) || !startsStructuredBlock(assigned)) {
      redacted.push(line);
      continue;
    }
    const separator = /\s$/.test(match[4]) ? match[4] : `${match[4]} `;
    redacted.push(`${match[1]}${match[2]}${match[3]}${match[2]}${separator}[REDACTED]`);
    const baseIndent = line.match(/^[ \t]*/)?.[0].length || 0;
    const bracketed = assigned.startsWith('[') || assigned.startsWith('{');
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      const nextIndent = next.match(/^[ \t]*/)?.[0].length || 0;
      const closesBlock = bracketed && /^[ \t]*[\]}],?[ \t]*$/.test(next);
      const indentlessSequence =
        !assigned && nextIndent === baseIndent && /^[ \t]*-\s+/.test(next);
      if (
        next.trim() &&
        nextIndent <= baseIndent &&
        !closesBlock &&
        !indentlessSequence
      )
        break;
      index += 1;
    }
  }
  return redacted.join('\n');
}

function startsStructuredBlock(value: string): boolean {
  if (!value || /^[|>][-+0-9]*$/.test(value)) return true;
  return (
    (value.startsWith('[') && !/\][,]?$/.test(value)) ||
    (value.startsWith('{') && !/\}[,]?$/.test(value))
  );
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

export function containsRepositoryStrongSecretText(value: string): boolean {
  return COMPLETE_PRIVATE_KEY.test(value) || STRONG_SECRET_TEXT.test(value);
}

export function containsRepositoryStructuredSecretText(
  value: string,
  keyMatcher: (key: string) => boolean = isSecretKey,
): boolean {
  for (const match of value.matchAll(STRUCTURED_ASSIGNMENT)) {
    if (!keyMatcher(String(match[1]))) continue;
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

function isSecretKey(value: string) {
  return REPOSITORY_SECRET_KEY_PATTERN.test(value) || isSecretEnvironmentName(value);
}

function isEnvironmentReference(value: string): boolean {
  const normalized = value.replace(/^['"]|['"]$/g, '');
  return /^\$(?:\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)$/.test(normalized);
}
