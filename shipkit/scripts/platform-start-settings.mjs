import { lstat } from 'node:fs/promises';
import path from 'node:path';

// Validate supervisor listen settings and persistent/private filesystem references.
export async function platformStartSettings(repo, env, production) {
  const dataRoot = path.resolve(env.SHIPKIT_DATA_DIR ?? path.join(repo, 'shipkit/.platform'));
  const webHost = env.SHIPKIT_WEB_HOST ?? '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(webHost)) throw new Error('Invalid SHIPKIT_WEB_HOST');
  if (production) {
    const keyFile = env.SHIPKIT_SECRET_KEY_FILE;
    if (!keyFile || !path.isAbsolute(keyFile)) throw new Error('Production requires an external SHIPKIT_SECRET_KEY_FILE; initialize it explicitly before startup');
    const key = await lstat(keyFile);
    if (!key.isFile() || key.size === 0 || (key.mode & 0o777) !== 0o600 || (process.getuid && key.uid !== process.getuid())) {
      throw new Error('Production secret key must be a nonempty 0600 file owned by the runtime user');
    }
    if (webHost === '0.0.0.0' && !env.SHIPKIT_PUBLIC_ORIGIN) {
      throw new Error('External Web listener requires an explicit SHIPKIT_PUBLIC_ORIGIN');
    }
  }
  return { dataRoot, logRoot: path.join(dataRoot, 'process-logs'), webHost };
}
