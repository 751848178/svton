import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertNoEncryptedData } from './key-init.guard.js';

// Explicit initialization only; wx refuses to overwrite any existing key file.
async function main(): Promise<void> {
const filename = process.env.SHIPKIT_SECRET_KEY_FILE;
if (process.argv[2] !== 'init' || !filename || !path.isAbsolute(filename)) {
  console.error('Usage: SHIPKIT_DATA_DIR=/absolute/data SHIPKIT_SECRET_KEY_FILE=/absolute/private/key.json node --import tsx src/secrets/key-init.cli.ts init');
  process.exitCode = 1;
} else {
  try {
    await assertNoEncryptedData();
    mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    const id = randomBytes(12).toString('hex');
    writeFileSync(filename, JSON.stringify({ version: 1, activeKeyId: id, keys: { [id]: randomBytes(32).toString('base64') } }), { flag: 'wx', mode: 0o600 });
    console.log('Secret key initialized; back it up separately before using configuration versions.');
  } catch { console.error('Key initialization refused; preserve and recover any existing key file.'); process.exitCode = 1; }
}
}
void main().catch(() => { console.error('Key initialization refused.'); process.exitCode = 1; });
