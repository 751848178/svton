import * as crypto from 'crypto';

/**
 * 加密 profile 常量。
 *
 * 历史上 devpilot-api 有三套并行的 AES 加解密实现被复制粘贴到 13 个 service：
 *  - cbc:        aes-256-cbc，无 auth tag，wire = `ivHex:ctHex`，key 来自 `Buffer.from(env.padEnd(32).slice(0,32))`
 *  - gcm:        aes-256-gcm，wire = `ivHex:authTagHex:ctHex`，key 来自 `scryptSync(env, 'salt', 32)`
 *  - gcm-webhook:aes-256-gcm，wire 同 gcm，但 key 来自 `scryptSync(env, 'webhook-secret', 32)`
 *
 * 已加密的 DB 行依赖各自的历史 wire 格式与 KDF salt，不能强行统一，否则旧数据无法解密。
 * 这里只把"读 env + 推导 key"的逻辑收敛到一处。
 *
 * CBC KDF 演进：历史上 `deriveCbcKey` 直接 `padEnd(32).slice(0,32)`，无 KDF，密钥强度弱
 * （尤其 ENCRYPTION_KEY 短于 32 字符时会被 pad 成可预测字符）。现在改为 `scryptSync`，与
 * GCM profile 一致。但旧 key 加密的历史密文仍需解密，故保留 `deriveCbcKeyLegacy`，由
 * `CryptoService.decryptCbc` 在新 key 解密失败时回退尝试。详见 `crypto.service.ts`。
 */
export const CRYPTO_ALGORITHM_CBC = 'aes-256-cbc' as const;
export const CRYPTO_ALGORITHM_GCM = 'aes-256-gcm' as const;

/** GCM profile 用的 scrypt salt（历史值，勿改）。 */
export const GCM_SALT = 'salt';
/** webhook profile 用的独立 scrypt salt（历史值，勿改；与 GCM_SALT 派生出的 key 不同）。 */
export const WEBHOOK_SALT = 'webhook-secret';
/** CBC profile 改造后的 scrypt salt（新值）。新写入的 CBC 密文用此 salt 派生 key。 */
export const CBC_SALT = 'cbc-salt';

/** CBC profile 兜底密钥（历史值，生产必须通过 ENCRYPTION_KEY 覆盖）。 */
export const CBC_DEFAULT_KEY = 'default-key-32-chars-long!!!!!';
/** GCM/webhook profile 兜底密钥（历史值，生产必须通过 ENCRYPTION_KEY 覆盖）。 */
export const GCM_DEFAULT_KEY = 'default-32-char-encryption-key!';

export const CBC_KEY_LENGTH = 32;
export const GCM_IV_LENGTH = 12;
export const CBC_IV_LENGTH = 16;
export const GCM_AUTH_TAG_LENGTH = 16;

/**
 * CBC profile 密钥派生（新）。
 * 改用 scryptSync，与 GCM profile 一致；新写入的 CBC 密文用此 key。
 */
export function deriveCbcKey(encryptionKey: string): Buffer {
  return crypto.scryptSync(encryptionKey ?? CBC_DEFAULT_KEY, CBC_SALT, CBC_KEY_LENGTH);
}

/**
 * CBC profile 密钥派生（历史 legacy）。
 * 旧实现：直接 `padEnd(32).slice(0,32)`，无 KDF。仅用于解密 KDF 改造前写入的历史密文。
 * `CryptoService.decryptCbc` 在新 key 解密失败时回退到此 key。待历史密文全部轮换后可删除。
 */
export function deriveCbcKeyLegacy(encryptionKey: string): Buffer {
  const raw = (encryptionKey ?? CBC_DEFAULT_KEY).padEnd(CBC_KEY_LENGTH).slice(0, CBC_KEY_LENGTH);
  return Buffer.from(raw);
}

export function deriveGcmKey(encryptionKey: string): Buffer {
  return crypto.scryptSync(encryptionKey ?? GCM_DEFAULT_KEY, GCM_SALT, CBC_KEY_LENGTH);
}

export function deriveWebhookKey(encryptionKey: string): Buffer {
  return crypto.scryptSync(encryptionKey ?? GCM_DEFAULT_KEY, WEBHOOK_SALT, CBC_KEY_LENGTH);
}
