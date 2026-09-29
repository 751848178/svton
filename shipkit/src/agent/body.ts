// Request body readers with size caps; large uploads stream to disk (F34).

import { createWriteStream } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { HttpFail } from './http-fail.js';

const JSON_LIMIT = 8 * 1024 * 1024;
const RAW_LIMIT = 300 * 1024 * 1024;

export function readRaw(req: IncomingMessage, limit = RAW_LIMIT): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpFail(413, 'payload_too_large', `body exceeds ${limit} bytes`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (e) => reject(new HttpFail(400, 'body_error', e.message)));
  });
}

export async function readJson(req: IncomingMessage): Promise<unknown> {
  const buf = await readRaw(req, JSON_LIMIT);
  if (buf.length === 0) return undefined;
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpFail(400, 'bad_json', 'request body is not valid JSON');
  }
}

/** stream a request body straight to disk with a hard cap; never buffered in memory (F34). */
export function streamBodyToFile(req: IncomingMessage, limit: number, filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = createWriteStream(filePath, { mode: 0o600 });
    let size = 0;
    let settled = false;
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      ws.destroy();
      reject(e);
    };
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        req.destroy();
        fail(new HttpFail(413, 'payload_too_large', `body exceeds ${limit} bytes`));
        return;
      }
      if (!ws.write(c)) {
        req.pause();
        ws.once('drain', () => req.resume());
      }
    });
    ws.on('error', (e: Error) => fail(new HttpFail(400, 'body_error', e.message)));
    req.on('error', (e: Error) => fail(new HttpFail(400, 'body_error', e.message)));
    req.on('end', () => {
      ws.end(() => {
        if (!settled) {
          settled = true;
          resolve(size);
        }
      });
    });
  });
}
