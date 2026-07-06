import * as crypto from 'crypto';
import {
  CBC_DEFAULT_KEY,
  CBC_IV_LENGTH,
  CRYPTO_ALGORITHM_CBC,
  deriveCbcKey,
} from '../common/crypto/crypto.constants';

/**
 * Resource-pool 凭据加解密（CBC profile）。
 *
 * 历史导出函数，被 `resource-pool.service.spec.ts` 与 `admin.service.spec.ts` 直接引用，
 * 因此保留函数签名。实现已收敛到 `common/crypto` 的 KDF 常量上，避免与 `CryptoService` 漂移。
 *
 * 服务内部新代码应注入 `CryptoService` 并使用 `encryptCbc`/`decryptCbc`。
 */
export function encryptResourcePoolCredential(text: string): string {
  const key = getCredentialKey();
  const iv = crypto.randomBytes(CBC_IV_LENGTH);
  const cipher = crypto.createCipheriv(CRYPTO_ALGORITHM_CBC, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptResourcePoolCredential(text: string): string {
  const [ivHex, encrypted] = text.split(':');
  if (!ivHex || !encrypted) {
    throw new Error('invalid encrypted credential format');
  }
  const key = getCredentialKey();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(CRYPTO_ALGORITHM_CBC, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function getCredentialKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY || CBC_DEFAULT_KEY;
  return deriveCbcKey(encryptionKey);
}
