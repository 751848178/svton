import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { platformRuntimeContext } from './platform-runtime-context.mjs';

test('container metadata includes its own namespace and never infers identity from a host name alone', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'shipkit-context-'));
  const files = { pidNamespace: path.join(root, 'namespace'), hostname: path.join(root, 'hostname'), containerMarker: path.join(root, 'marker') };
  try {
    await symlink('pid:[123456]', files.pidNamespace);
    await writeFile(files.hostname, '0123456789ab\n');
    assert.deepEqual(await platformRuntimeContext('/var/lib/shipkit', files), { pidNamespace: 'pid:[123456]' });
    await writeFile(files.containerMarker, '');
    assert.deepEqual(await platformRuntimeContext('/var/lib/shipkit', files), {
      pidNamespace: 'pid:[123456]', containerId: '0123456789ab', containerDataRoot: '/var/lib/shipkit',
    });
    await writeFile(files.hostname, 'user-host');
    assert.deepEqual(await platformRuntimeContext('/var/lib/shipkit', files), { pidNamespace: 'pid:[123456]' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
