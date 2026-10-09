import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { readKeyRing } from './key-file.js';
import { canonical, type SecretScope } from './secret-scope.js';

interface Envelope { version: 1; keyId: string; nonce: string; tag: string; data: string }

@Injectable()
export class SecretStore {
  seal<T>(value: T, scope: SecretScope): string {
    const ring = readKeyRing();
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', ring.keys[ring.activeKeyId]!, nonce);
    cipher.setAAD(Buffer.from(canonical(scope)));
    const encrypted = Buffer.concat([cipher.update(canonical(value), 'utf8'), cipher.final()]);
    return JSON.stringify({ version: 1, keyId: ring.activeKeyId, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') } satisfies Envelope);
  }
  open<T>(encrypted: string, scope: SecretScope): T {
    const ring = readKeyRing();
    try {
      const envelope = JSON.parse(encrypted) as Envelope;
      if (envelope.version !== 1 || !ring.keys[envelope.keyId]) throw new Error('Unknown key');
      const nonce = Buffer.from(envelope.nonce, 'base64'), tag = Buffer.from(envelope.tag, 'base64');
      if (nonce.length !== 12 || tag.length !== 16) throw new Error('Invalid envelope');
      const decipher = createDecipheriv('aes-256-gcm', ring.keys[envelope.keyId]!, nonce);
      decipher.setAAD(Buffer.from(canonical(scope))); decipher.setAuthTag(tag);
      const plain = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
      return JSON.parse(plain.toString('utf8')) as T;
    } catch { throw new ServiceUnavailableException('配置密文无法验证，请恢复匹配的历史密钥与数据'); }
  }
  fingerprint(value: unknown, scope: SecretScope): string {
    const ring = readKeyRing();
    const key = createHmac('sha256', ring.keys[ring.activeKeyId]!).update('shipkit:fingerprint:v1').digest();
    return `${ring.activeKeyId}:${createHmac('sha256', key).update(canonical(scope)).update('\0').update(canonical(value)).digest('hex')}`;
  }
}
