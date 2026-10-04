// Single node-core HTTP transport for every controller→agent call (M2-10):
// node's global fetch cannot take a custom CA, so entries paired with
// `--ca-file` would silently lose trust in doctor/init/release. All agent-API
// calls go through here, where an optional pinned CA file is honored.
// TLS verification is never disabled.

import { request as httpRequest } from 'node:http';
import { request as httpsRequest, Agent as HttpsAgent } from 'node:https';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface TransportOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  /** PEM CA bundle pinned by `ship pair --ca-file`; resolved relative to cwd */
  caFile?: string;
  timeoutMs?: number;
}

export interface TransportResult {
  status: number;
  body: Buffer;
}

export class TransportError extends Error {}

function loadCa(caFile: string): Buffer {
  if (!path.isAbsolute(caFile)) {
    throw new TransportError(
      `CA 引用是相对路径 '${caFile}'（历史记录，会随工作目录漂移）——用绝对路径重新执行 ship pair <url> --ca-file /绝对/路径/ca.pem，或编辑 ~/.ship/credentials.json 修正该条目；不要改用当前目录下同名证书`,
    );
  }
  try {
    return readFileSync(caFile);
  } catch (e) {
    throw new TransportError(
      `无法读取 CA 文件 ${caFile}（${e instanceof Error ? e.message : String(e)}）——该入口以 ship pair --ca-file 配对，须保留同一 CA 文件才能建立信任`,
    );
  }
}

/** no agent/CA caching by design (M2-R3): the CA file is re-read per call so a
 *  deleted or replaced pinned reference fails immediately instead of continuing
 *  on stale trust material. */
function agentFor(caFile: string): HttpsAgent {
  return new HttpsAgent({ ca: loadCa(caFile) });
}

/** buffered request with a hard timeout; custom CA only narrows trust, never
 * widens it. async so a bad CA reference rejects instead of throwing synchronously. */
export async function requestBuffered(url: string, opts: TransportOptions = {}): Promise<TransportResult> {
  const u = new URL(url);
  const useCa = u.protocol === 'https:' && opts.caFile;
  const agent = useCa ? agentFor(opts.caFile!) : undefined;
  const payload = opts.body;
  const headers: Record<string, string> = {
    ...(payload !== undefined ? { 'content-length': String(typeof payload === 'string' ? Buffer.byteLength(payload) : payload.byteLength) } : {}),
    ...opts.headers,
  };
  const timeoutMs = opts.timeoutMs ?? 20_000;
  return new Promise((resolve, reject) => {
    const req = (u.protocol === 'https:' ? httpsRequest : httpRequest)(
      u,
      { method: opts.method ?? 'GET', agent, headers, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
        res.on('error', (e: Error) => reject(new TransportError(e.message)));
      },
    );
    req.on('timeout', () => req.destroy(new TransportError(`request timed out after ${timeoutMs}ms`)));
    req.on('error', (e: Error) => reject(e instanceof TransportError ? e : new TransportError(e.message)));
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}
