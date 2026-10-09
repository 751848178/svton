import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listProjectAgentConnections, checkProjectAgentConnection } from './agent-connections.js';

test('Agent discovery strips endpoint credentials and queries without resolving tokens or reading service env', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'agent-inventory-'));
  const configPath = path.join(rootPath, 'private.json');
  const input = { rootPath, configPath };
  try {
    const raw = { builder: { mode: 'static', static: { url: 'http://user:password@127.0.0.1:1/?token=url-secret', tokenRef: 'unpaired-fixture' } }, runtime: { targets: { prod: { url: 'http://127.0.0.1:1', tokenRef: 'unpaired-fixture' } } } };
    await writeFile(configPath, JSON.stringify(raw), { mode: 0o600 });
    const result = await listProjectAgentConnections(input);
    assert.equal(result.connections.length, 2);
    assert(result.connections.every(connection => connection.endpoint === 'http://127.0.0.1:1'));
    for (const secret of ['password', 'url-secret', 'unpaired-fixture']) assert(!JSON.stringify(result).includes(secret));
    const removed = await checkProjectAgentConnection(input, 'runtime:missing');
    assert.equal(removed.ok, false);
    assert.match(removed.error!, /已从项目配置中移除/);
    const changed = await checkProjectAgentConnection(input, 'runtime:prod', 'http://127.0.0.1:9999');
    assert.equal(changed.ok, false);
    assert.match(changed.error!, /端点已变更/);
    await writeFile(configPath, 'invalid-token-contents');
    await assert.rejects(listProjectAgentConnections(input), error => !String(error).includes('invalid-token-contents'));
  } finally { await rm(rootPath, { recursive: true, force: true }); }
});
