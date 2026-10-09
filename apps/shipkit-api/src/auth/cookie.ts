import { createHash } from 'node:crypto';
import { SESSION_COOKIE } from './settings.js';

export const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function readSessionCookie(header: string | undefined): string | null {
  if (!header || header.length > 8192) return null;
  const matches = header.split(';').map(value => value.trim()).filter(value => value.startsWith(`${SESSION_COOKIE}=`));
  const token = matches[0]?.slice(SESSION_COOKIE.length + 1);
  return matches.length === 1 && /^[\w-]{43}$/.test(token ?? '') ? token! : null;
}
