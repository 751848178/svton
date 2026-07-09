import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  CBC_DEFAULT_KEY,
  CBC_IV_LENGTH,
  CBC_KEY_LENGTH,
  CRYPTO_ALGORITHM_CBC,
  CRYPTO_ALGORITHM_GCM,
  deriveCbcKey,
  deriveCbcKeyLegacy,
  deriveGcmKey,
  deriveWebhookKey,
  GCM_DEFAULT_KEY,
  GCM_IV_LENGTH,
} from './crypto.constants';

/**
 * devpilot-api 统一加解密服务。
 *
 * 取代历史上散落在 13 个 service 里的复制粘贴 AES 实现。所有方法保持原有 wire 格式，
 * 以便解密已落库的历史数据。新写入的密文仍走对应 profile 的历史格式，确保前后兼容。
 *
 * 三个 profile 的语义见 `crypto.constants.ts`。
 *
 * 新代码请优先使用 {@link encryptGcm} / {@link decryptGcm}（AEAD，带认证），
 * 只在需要兼容历史 CBC 数据时才走 {@link decryptCbc} / {@link encryptCbc}。
 */
@Injectable()
export class CryptoService {
  private readonly cbcKey: Buffer;
  private readonly cbcLegacyKey: Buffer;
  private readonly gcmKey: Buffer;
  private readonly webhookKey: Buffer;

  constructor(configService: ConfigService) {
    const encryptionKey = configService.get<string>('ENCRYPTION_KEY');
    this.cbcKey = deriveCbcKey(encryptionKey ?? CBC_DEFAULT_KEY);
    this.cbcLegacyKey = deriveCbcKeyLegacy(encryptionKey ?? CBC_DEFAULT_KEY);
    this.gcmKey = deriveGcmKey(encryptionKey ?? GCM_DEFAULT_KEY);
    this.webhookKey = deriveWebhookKey(encryptionKey ?? GCM_DEFAULT_KEY);
  }

  // ---------- GCM profile（绝大多数凭据/令牌） ----------

  /** AES-256-GCM 加密，输出 `ivHex:authTagHex:ciphertextHex`。 */
  encryptGcm(plainText: string): string {
    return this.encryptGcmWithKey(plainText, this.gcmKey);
  }

  /** 解密 {@link encryptGcm} 的输出（兼容历史 12/16 字节 IV）。 */
  decryptGcm(encryptedText: string): string {
    return this.decryptGcmWithKey(encryptedText, this.gcmKey);
  }

  // ---------- Webhook profile（独立 salt，不可与 gcm 互换） ----------

  /** AES-256-GCM 加密，使用 `'webhook-secret'` salt 派生 key。 */
  encryptWebhook(plainText: string): string {
    return this.encryptGcmWithKey(plainText, this.webhookKey);
  }

  /** 解密 {@link encryptWebhook} 的输出。 */
  decryptWebhook(encryptedText: string): string {
    return this.decryptGcmWithKey(encryptedText, this.webhookKey);
  }

  // ---------- CBC profile（历史凭据兼容，无 AEAD） ----------

  /** AES-256-CBC 加密，输出 `ivHex:ciphertextHex`。仅用于与历史 CBC 数据互操作。 */
  encryptCbc(plainText: string): string {
    const iv = crypto.randomBytes(CBC_IV_LENGTH);
    const cipher = crypto.createCipheriv(CRYPTO_ALGORITHM_CBC, this.cbcKey, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密 {@link encryptCbc} 的输出（兼容历史 legacy key）。
   *
   * KDF 改造前用 `deriveCbcKeyLegacy`（padEnd 截断），改造后用 `deriveCbcKey`（scrypt）。
   * 先用新 key 解密，`final()` 失败（CBC padding 错误，意味着 key 不匹配）时回退到 legacy key。
   * 格式错误（split 后缺段）直接抛错，不回退。
   */
  decryptCbc(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('invalid encrypted credential format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    try {
      return this.decryptCbcWithKey(iv, encrypted, this.cbcKey);
    } catch {
      return this.decryptCbcWithKey(iv, encrypted, this.cbcLegacyKey);
    }
  }

  private decryptCbcWithKey(iv: Buffer, encrypted: string, key: Buffer): string {
    const decipher = crypto.createDecipheriv(CRYPTO_ALGORITHM_CBC, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ---------- 内部 ----------

  private encryptGcmWithKey(plainText: string, key: Buffer): string {
    const iv = crypto.randomBytes(GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv(CRYPTO_ALGORITHM_GCM, key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decryptGcmWithKey(encryptedText: string, key: Buffer): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('invalid encrypted credential format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(CRYPTO_ALGORITHM_GCM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

/** CBC key 长度，暴露给测试断言用。 */
export const CRYPTO_CBC_KEY_LENGTH = CBC_KEY_LENGTH;
