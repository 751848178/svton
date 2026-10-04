// Pairing transport for `ship pair` (and the wizard's pairing step): the shared
// node-core transport with an optional custom CA. `ship pair --ca-file` verifies
// a self-signed entry against an administrator-provided CA; the same CA is then
// pinned in the stored credential so later doctor/init/release calls trust the
// identical entry (M2-10).

import { requestBuffered } from '../shared/http-transport.js';

export interface PairResponse {
  status: number;
  body: unknown;
}

export async function requestJson(
  url: string,
  opts: { method?: string; body?: unknown; caFile?: string; timeoutMs?: number } = {},
): Promise<PairResponse> {
  const res = await requestBuffered(url, {
    method: opts.method,
    timeoutMs: opts.timeoutMs ?? 15_000,
    caFile: opts.caFile,
    headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = res.body.toString('utf8');
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep as text
  }
  return { status: res.status, body };
}

const LOOPBACK_RE = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

export function entrySecurity(url: string, allowInsecureHttp: boolean): { ok: true } | { ok: false; message: string } {
  const u = new URL(url);
  if (u.protocol === 'https:') return { ok: true };
  if (u.protocol !== 'http:') return { ok: false, message: `入口协议必须是 http(s)://，当前 ${u.protocol}` };
  if (LOOPBACK_RE.test(u.hostname)) return { ok: true };
  if (allowInsecureHttp) return { ok: true };
  return {
    ok: false,
    message: `配对必须走 HTTPS 入口（当前 ${u.origin}）：明文 http 会让一次性配对码与长期 token 暴露在链路上。本机回环地址除外；受控内网确需明文时显式加 --allow-insecure-http。`,
  };
}
