import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  CBC_DEFAULT_KEY,
  CBC_IV_LENGTH,
  CRYPTO_ALGORITHM_CBC,
  deriveCbcKey,
  deriveCbcKeyLegacy,
} from './crypto.constants';
import { CryptoService } from './crypto.service';

/**
 * 用 legacy KDF（padEnd 截断，无 scrypt）加密一段明文，模拟 KDF 改造前写入的历史密文。
 * wire 格式与 CryptoService.encryptCbc 一致：`ivHex:ctHex`。
 */
function encryptWithLegacyKey(plainText: string, encryptionKey: string): string {
  const key = deriveCbcKeyLegacy(encryptionKey);
  const iv = crypto.randomBytes(CBC_IV_LENGTH);
  const cipher = crypto.createCipheriv(CRYPTO_ALGORITHM_CBC, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function createService(encryptionKey: string): CryptoService {
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'ENCRYPTION_KEY') return encryptionKey;
      return fallback;
    }),
  } as unknown as ConfigService;
  return new CryptoService(configService);
}

describe('CryptoService CBC KDF', () => {
  const key = 'production-32-char-encryption-key!';

  it('encryptCbc now derives key via scrypt (not padEnd)', () => {
    const service = createService(key);
    const cipherText = service.encryptCbc('payload');
    // 新 key 与 legacy key 不同 → 新密文能用新 key 解、但不能用 legacy key 解
    expect(service.decryptCbc(cipherText)).toBe('payload');

    const legacyDirect = crypto.createDecipheriv(
      CRYPTO_ALGORITHM_CBC,
      deriveCbcKeyLegacy(key),
      Buffer.from(cipherText.split(':')[0], 'hex'),
    );
    expect(() => legacyDirect.final('utf8')).toThrow();
  });

  it('decryptCbc decrypts legacy-key ciphertext (backward compatibility)', () => {
    const service = createService(key);
    const legacyCipher = encryptWithLegacyKey('historical-secret', key);
    // 历史密文：新 key 失败 → 回退 legacy key → 解出
    expect(service.decryptCbc(legacyCipher)).toBe('historical-secret');
  });

  it('encrypt → decrypt round-trip is stable under new KDF', () => {
    const service = createService(key);
    const cipherText = service.encryptCbc('{"user":"root","pass":"x"}');
    expect(cipherText).not.toContain('{"user"');
    expect(service.decryptCbc(cipherText)).toBe('{"user":"root","pass":"x"}');
  });

  it('decryptCbc rejects malformed wire format without falling back', () => {
    const service = createService(key);
    expect(() => service.decryptCbc('not-a-valid-format')).toThrow(
      'invalid encrypted credential format',
    );
  });

  it('falls back to legacy key when env is undefined (CBC_DEFAULT_KEY path)', () => {
    // ConfigService.get 返回 undefined → deriveCbcKey 回退 CBC_DEFAULT_KEY
    const configService = { get: jest.fn(() => undefined) } as unknown as ConfigService;
    const service = new CryptoService(configService);
    const legacyCipher = encryptWithLegacyKey('default-key-payload', CBC_DEFAULT_KEY);
    expect(service.decryptCbc(legacyCipher)).toBe('default-key-payload');
  });
});
