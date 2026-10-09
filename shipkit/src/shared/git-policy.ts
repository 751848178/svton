import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface GitHostPolicy { allowedHosts?: string[]; allowPrivateHosts?: string[]; dnsTimeoutMs?: number }
const configured = (key: string, fallback: string[]) => process.env[key]?.split(',').map(v => v.trim().toLowerCase()).filter(Boolean) ?? fallback;
export function assertGitRepositoryUrl(raw: string, options: GitHostPolicy = {}): URL {
  let url: URL; try { url = new URL(raw); } catch { throw new Error('Repository URL is invalid'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname || url.pathname === '/') throw new Error('Repository requires a credential-free HTTPS URL');
  const allowed = options.allowedHosts ?? configured('SHIPKIT_GIT_ALLOWED_HOSTS', ['github.com', 'gitlab.com']);
  if (!allowed.map(v => v.toLowerCase()).includes(url.hostname.toLowerCase())) throw new Error('Repository host is not allowed by the deployment administrator');
  return url;
}
export function privateGitAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a! >= 224 || a === 169 && b === 254 || a === 172 && b! >= 16 && b! <= 31
      || a === 192 && (b === 168 || b === 0) || a === 100 && b! >= 64 && b! <= 127 || a === 198 && (b === 18 || b === 19);
  }
  if (isIP(address) !== 6) return true;
  const lower = address.toLowerCase();
  if (lower.startsWith('::ffff:')) return privateGitAddress(lower.slice(7));
  return lower === '::' || lower === '::1' || /^(fc|fd|fe[89ab]|ff)/.test(lower);
}
/** Every result is checked; callers pin an approved address for the actual connection. */
export async function resolveGitAddresses(hostname: string, options: GitHostPolicy = {}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([lookup(hostname, { all: true }), new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Repository DNS lookup timed out')), Math.min(options.dnsTimeoutMs ?? 10000, 30000));
  })]).finally(() => { if (timer) clearTimeout(timer); });
  const privateHosts = options.allowPrivateHosts ?? configured('SHIPKIT_GIT_ALLOW_PRIVATE_HOSTS', []);
  if (!addresses.length || addresses.some(item => privateGitAddress(item.address)) && !privateHosts.map(v => v.toLowerCase()).includes(hostname.toLowerCase())) {
    throw new Error('Repository resolves to a prohibited network address');
  }
  return addresses;
}
