import { Injectable } from '@nestjs/common';
import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'shipkit_session';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
@Injectable()
export class AuthSettings {
  readonly origins: Set<string>;
  readonly secure: boolean;
  readonly sessionMs = 12 * 60 * 60_000;
  constructor() {
    const configured = process.env.SHIPKIT_PUBLIC_ORIGIN;
    const origin = configured ?? 'http://127.0.0.1:8769';
    let url: URL;
    try { url = new URL(origin); } catch { throw new Error('SHIPKIT_PUBLIC_ORIGIN 必须是完整页面来源'); }
    if (url.origin !== origin || url.username || url.password || !['http:', 'https:'].includes(url.protocol)
      || (url.protocol === 'http:' && !LOOPBACK.has(url.hostname))) {
      throw new Error('外部页面来源必须明确使用 HTTPS；本机开发可使用 HTTP');
    }
    this.secure = url.protocol === 'https:';
    this.origins = new Set(configured ? [origin] : [origin, 'http://localhost:8769', 'http://[::1]:8769']);
  }
  cookie(): CookieOptions { return { httpOnly: true, sameSite: 'strict', secure: this.secure, path: '/' }; }
}
