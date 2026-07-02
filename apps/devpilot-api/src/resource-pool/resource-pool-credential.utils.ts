import * as crypto from 'crypto';

const DEFAULT_ENCRYPTION_KEY = 'default-key-32-chars-long!!!!!';

function getCredentialKey() {
  const key = process.env.ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY;
  return Buffer.from(key.padEnd(32));
}

export function encryptResourcePoolCredential(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getCredentialKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptResourcePoolCredential(text: string): string {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getCredentialKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
