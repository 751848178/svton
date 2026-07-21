import { unquoteShellToken } from './shell-command.utils';

const C_STYLE_DELIMITERS = new Map([
  ['\\0', '\0'],
  ['\\a', '\x07'],
  ['\\b', '\b'],
  ['\\f', '\f'],
  ['\\n', '\n'],
  ['\\r', '\r'],
  ['\\t', '\t'],
  ['\\v', '\v'],
  ['\\\\', '\\'],
]);

export function parseXargsDelimiterToken(token: string): string | undefined {
  const value = unquoteShellToken(token);
  if (value.length === 1) return value;
  const escaped = C_STYLE_DELIMITERS.get(value);
  if (escaped !== undefined) return escaped;

  const hex = value.match(/^\\x([0-9a-fA-F]{1,2})$/);
  if (hex) return String.fromCharCode(Number.parseInt(hex[1], 16));

  const octal = value.match(/^\\([0-7]{1,3})$/);
  return octal ? String.fromCharCode(Number.parseInt(octal[1], 8)) : undefined;
}
