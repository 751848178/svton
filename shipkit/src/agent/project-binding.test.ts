import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

let readFault: string | undefined;
let directoryFault: string | undefined;
mock.module('node:fs/promises', {
  namedExports: {
    ...fs,
    readFile: async (file: string, ...args: unknown[]) => {
      if (file === readFault) throw Object.assign(new Error('fixture permission error'), { code: 'EACCES' });
      return (fs.readFile as Function)(file, ...args);
    },
    readdir: async (dir: string, ...args: unknown[]) => {
      if (dir === directoryFault) throw Object.assign(new Error('fixture evidence read error'), { code: 'EIO' });
      return (fs.readdir as Function)(dir, ...args);
    },
  },
});
const { assertProjectBinding } = await import('./project-binding.js');
const owner = { app: 'web', project: 'git.example/team/a', env: 'prod' };
async function fixture(t: { after(fn: () => Promise<void>): void }): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'ship-binding-'));
  t.after(async () => { readFault = directoryFault = undefined; await fs.rm(root, { recursive: true, force: true }); });
  return path.join(root, 'web');
}

test('fresh claim is private, repeatable, and cannot be changed by another project or environment', async (t) => {
  const dir = await fixture(t);
  await assertProjectBinding(dir, owner);
  const file = path.join(dir, 'project.json');
  const original = await fs.readFile(file, 'utf8');
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  await assertProjectBinding(dir, owner, true);
  await assert.rejects(() => assertProjectBinding(dir, { ...owner, env: 'staging' }), /prod.*环境/);
  await assert.rejects(() => assertProjectBinding(dir, { ...owner, project: 'git.example/team/b' }), /其他项目/);
  assert.equal(await fs.readFile(file, 'utf8'), original);
});

test('all existing app entries block automatic migration, including empty release directories', async (t) => {
  for (const entry of ['state.json', 'releases', 'compose.yaml', 'runtime.env', 'unknown-file']) {
    const dir = await fixture(t);
    await fs.mkdir(dir);
    if (entry === 'releases') await fs.mkdir(path.join(dir, entry));
    else await fs.writeFile(path.join(dir, entry), 'legacy evidence');
    await assert.rejects(() => assertProjectBinding(dir, owner), /已有部署证据/);
    await assert.rejects(() => fs.readFile(path.join(dir, 'project.json')), { code: 'ENOENT' });
  }
});

test('existing containers block a claim even after local deployment data has been lost', async (t) => {
  const dir = await fixture(t);
  await assert.rejects(() => assertProjectBinding(dir, owner, true), /已有 Compose 容器/);
  await assert.rejects(() => fs.stat(dir), { code: 'ENOENT' });
});

test('unreadable deployment evidence fails closed without writing a binding', async (t) => {
  const dir = await fixture(t);
  await fs.mkdir(dir);
  directoryFault = dir;
  await assert.rejects(() => assertProjectBinding(dir, owner), /无法读取旧部署证据/);
  await assert.rejects(() => fs.readFile(path.join(dir, 'project.json')), { code: 'ENOENT' });
});

test('read failures and malformed records preserve the original binding', async (t) => {
  const dir = await fixture(t);
  await fs.mkdir(dir);
  const file = path.join(dir, 'project.json');
  for (const data of ['{ broken', 'null', '[]', '{}', '{"app":"web","project":"a"}']) {
    await fs.writeFile(file, data);
    await assert.rejects(() => assertProjectBinding(dir, owner), /拒绝执行.*(损坏|结构非法)/);
    assert.equal(await fs.readFile(file, 'utf8'), data);
  }
  const data = JSON.stringify(owner);
  await fs.writeFile(file, data);
  readFault = file;
  await assert.rejects(() => assertProjectBinding(dir, owner), /无法读取项目绑定/);
  assert.equal(await fs.readFile(file, 'utf8'), data);
});

test('concurrent first claims never overwrite the winning identity', async (t) => {
  const dir = await fixture(t);
  const identities = [owner, { ...owner, project: 'git.example/team/b' }];
  const results = await Promise.allSettled(identities.map((id) => assertProjectBinding(dir, id)));
  const winners = results.flatMap((r, index) => r.status === 'fulfilled' ? [index] : []);
  assert.equal(winners.length, 1);
  const stored = JSON.parse(await fs.readFile(path.join(dir, 'project.json'), 'utf8'));
  assert.equal(stored.project, identities[winners[0]!]!.project);
});
