/**
 * AES-256-GCM credential encryption helpers for resource instances.
 *
 * Pure functions extracted verbatim from `ResourceRequestService.encrypt` /
 * `decrypt` so the encryption boundary (key + algorithm) is owned by the
 * service that holds the key, while the encrypt/decrypt logic is reusable.
 * No behavior change — identical algorithm, IV size, and output format.
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptCredential(text: string, encryptionKey: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptCredential(encryptedText: string, encryptionKey: Buffer): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
