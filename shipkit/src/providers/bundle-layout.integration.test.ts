import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startBundleServer, type BundleServer } from './bundle-server.js';
import { exec } from '../shared/exec.js';
import { SHIP_VERSION } from '../shared/types.js';

test('real HTTP bundle extracts dist contents at the installer root', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-bundle-layout-'));
  const distDir = path.join(dir, 'dist');
  const bootstrapDir = path.join(dir, 'bootstrap');
  const extracted = path.join(dir, 'extracted');
  let bundle: BundleServer | undefined;
  try {
    await mkdir(path.join(distDir, 'agent'), { recursive: true });
    await mkdir(path.join(distDir, 'shared'), { recursive: true });
    await mkdir(bootstrapDir);
    await mkdir(extracted);
    const markers = {
      'agent/server.js': 'export const marker = "server-at-root";\n',
      'shared/marker.js': 'export const marker = "nested-dist-content";\n',
      '.layout-marker': 'hidden-dist-content\n',
    };
    for (const [file, text] of Object.entries(markers)) await writeFile(path.join(distDir, file), text);
    await writeFile(path.join(bootstrapDir, 'install.sh'), '#!/bin/sh\n# __BUNDLE_BASE__ __ROLE__\n');
    bundle = await startBundleServer({ distDir, bootstrapDir, advertiseHost: '127.0.0.1', port: 0 });

    const response = await fetch(`${bundle.base}/agent.tgz`);
    assert.equal(response.status, 200);
    const archive = Buffer.from(await response.arrayBuffer());
    const sumsResponse = await fetch(`${bundle.base}/SHA256SUMS`);
    assert.equal(sumsResponse.status, 200);
    assert.equal(await sumsResponse.text(), `${createHash('sha256').update(archive).digest('hex')}  agent.tgz\n`);
    const tgz = path.join(dir, 'downloaded.tgz');
    await writeFile(tgz, archive);
    const unpack = await exec('tar', ['xzf', tgz, '-C', extracted]);
    assert.equal(unpack.code, 0, unpack.stderr);

    for (const [file, text] of Object.entries(markers)) {
      assert.equal(await readFile(path.join(extracted, file), 'utf8'), text, file);
    }
    assert.deepEqual(JSON.parse(await readFile(path.join(extracted, 'package.json'), 'utf8')), {
      name: 'shipkit-agent', version: SHIP_VERSION, private: true, type: 'module',
    });
    assert.equal(await readFile(path.join(extracted, 'VERSION'), 'utf8'), `${SHIP_VERSION}\n`);
    await assert.rejects(access(path.join(extracted, 'dist')), { code: 'ENOENT' });
  } finally {
    if (bundle) await bundle.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
