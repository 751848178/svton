import { readFile, stat } from 'node:fs/promises';

// Integration tools use a pre-provisioned account; never an anonymous bypass.
const sessions = new Map();
export async function testSessionCookie(base) {
  if (!sessions.has(base)) sessions.set(base, login(base));
  return sessions.get(base);
}
async function login(base) {
  const url = new URL(base);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/api' || url.search || url.hash) {
    throw new Error('Integration credentials may only be sent to a loopback /api fixture');
  }
  const file = process.env.SHIPKIT_TEST_CREDENTIALS_FILE;
  if (!file) throw new Error('Set SHIPKIT_TEST_CREDENTIALS_FILE to a private JSON file for an isolated test account');
  const info = await stat(file);
  if (!info.isFile() || (info.mode & 0o077)) throw new Error('Test credential file must be private (0600)');
  const { username, password } = JSON.parse(await readFile(file, 'utf8'));
  const response = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-shipkit-local': '1' },
    body: JSON.stringify({ username, password }),
    redirect: 'error',
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!response.ok || !cookie?.startsWith('shipkit_session=')) throw new Error(`Test login failed (${response.status})`);
  return cookie;
}
