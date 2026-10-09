import { ServiceUnavailableException } from '@nestjs/common';
import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';

export interface KeyRing { activeKeyId: string; keys: Record<string, Buffer> }

export function readKeyRing(): KeyRing {
  let descriptor: number | undefined;
  try {
    const file = process.env.SHIPKIT_SECRET_KEY_FILE;
    if (!file) throw new Error('Missing key reference');
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || (process.getuid && stat.uid !== process.getuid())) throw new Error('Unsafe key file');
    const data = JSON.parse(readFileSync(descriptor, 'utf8')) as { version?: number; activeKeyId?: string; keys?: Record<string, unknown> };
    if (data.version !== 1 || !data.activeKeyId || !data.keys || !/^[a-zA-Z0-9_-]{1,80}$/.test(data.activeKeyId)) throw new Error('Invalid key ring');
    const keys: Record<string, Buffer> = Object.create(null);
    for (const [id, encoded] of Object.entries(data.keys)) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || typeof encoded !== 'string') throw new Error('Invalid key');
      const key = Buffer.from(encoded, 'base64');
      if (key.length !== 32 || key.toString('base64') !== encoded) throw new Error('Invalid key');
      keys[id] = key;
    }
    if (!keys[data.activeKeyId]) throw new Error('Missing active key');
    return { activeKeyId: data.activeKeyId, keys };
  } catch { throw new ServiceUnavailableException('配置主密钥不可用，请恢复原密钥及其安全权限'); }
  finally { if (descriptor !== undefined) closeSync(descriptor); }
}
