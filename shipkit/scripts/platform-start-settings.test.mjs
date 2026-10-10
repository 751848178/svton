import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { platformStartSettings } from './platform-start-settings.mjs';

test('local startup remains loopback while production requires an existing external key and origin', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'shipkit-start-'));
  try {
    const local = await platformStartSettings(root, {}, false);
    assert.equal(local.webHost, '127.0.0.1');
    assert.equal(local.logRoot, path.join(root, 'shipkit/.platform/process-logs'));
    await assert.rejects(platformStartSettings(root, {}, true), /external SHIPKIT_SECRET_KEY_FILE/);
    const key = path.join(root, 'key.json');
    await assert.rejects(platformStartSettings(root, { SHIPKIT_SECRET_KEY_FILE: key }, true), /ENOENT/);
    await writeFile(key, '{}', { mode: 0o600 });
    const env = { SHIPKIT_SECRET_KEY_FILE: key, SHIPKIT_WEB_HOST: '0.0.0.0' };
    await assert.rejects(platformStartSettings(root, env, true), /SHIPKIT_PUBLIC_ORIGIN/);
    const production = await platformStartSettings(root, { ...env, SHIPKIT_PUBLIC_ORIGIN: 'http://localhost:28769' }, true);
    assert.equal(production.webHost, '0.0.0.0');
    await chmod(key, 0o644);
    await assert.rejects(platformStartSettings(root, env, true), /0600/);
    await chmod(key, 0o600);
    const link = path.join(root, 'link.json'); await symlink(key, link);
    await assert.rejects(platformStartSettings(root, { SHIPKIT_SECRET_KEY_FILE: link }, true), /0600/);
    for (const host of ['remote.example', 'localhost', '::1', '::']) {
      await assert.rejects(platformStartSettings(root, { SHIPKIT_WEB_HOST: host }, false), /Invalid SHIPKIT_WEB_HOST/);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
