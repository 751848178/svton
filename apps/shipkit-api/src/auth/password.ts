import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384, r = 8, p = 1;
const derive = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 32, { N, r, p, maxmem: 32 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
const valid = (password: unknown): password is string => typeof password === 'string' && password.length > 0 && Buffer.byteLength(password) <= 256;
export const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(32).toString('base64url')}`;
export async function hashPassword(password: string): Promise<string> {
  if (!valid(password) || password.length < 12) throw new Error('密码须至少 12 个字符且不超过 256 字节');
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${(await derive(password, salt)).toString('base64url')}`;
}
export async function verifyPassword(password: unknown, hash: string): Promise<boolean> {
  if (!valid(password)) return false;
  const [algorithm, encodedSalt, encodedKey, extra] = hash.split('$');
  if (algorithm !== 'scrypt' || !/^[\w-]{22}$/.test(encodedSalt ?? '') || !/^[\w-]{43}$/.test(encodedKey ?? '') || extra !== undefined) return false;
  const salt = Buffer.from(encodedSalt!, 'base64url'), key = Buffer.from(encodedKey!, 'base64url');
  return salt.length === 16 && key.length === 32 && timingSafeEqual(await derive(password, salt), key);
}
