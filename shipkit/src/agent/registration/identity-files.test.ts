import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, link, symlink, writeFile, stat, readdir, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { identityFixture } from './identity-fixture.js';
import { readPrivateRegistrationJson } from './identity-read.js';
import { writeRegistrationIdentityJson, type IdentityWriteStage } from './identity-write.js';
import { assertPrivateFile } from './identity-paths.js';
import { RegistrationIdentityError } from './identity-error.js';

test('descriptor reads reject insecure modes, hard links, final symlinks, parent symlinks and FIFO', async () => {
  const fixture = await identityFixture();
  try {
    const original = fixture.config.enrollmentFile!;
    await chmod(original, 0o640);
    await assert.rejects(() => readPrivateRegistrationJson(original), RegistrationIdentityError);
    await chmod(original, 0o600);
    const hard = path.join(fixture.directory, 'hard.json'); await link(original, hard);
    await assert.rejects(() => readPrivateRegistrationJson(hard), RegistrationIdentityError);
    const symbolic = path.join(fixture.directory, 'symbolic.json'); await symlink(original, symbolic);
    await assert.rejects(() => readPrivateRegistrationJson(symbolic), RegistrationIdentityError);
    const alias = path.join(fixture.directory, 'alias'); await symlink(fixture.directory, alias);
    await assert.rejects(() => readPrivateRegistrationJson(path.join(alias, 'enrollment.json')), RegistrationIdentityError);
    const fifo = path.join(fixture.directory, 'fifo'); await promisify(execFile)('mkfifo', [fifo]);
    await assert.rejects(() => readPrivateRegistrationJson(fifo), RegistrationIdentityError);
    const foreign = await stat(original);
    assert.throws(() => assertPrivateFile(Object.assign(Object.create(Object.getPrototypeOf(foreign)), foreign,
      { nlink: 1, uid: Math.max(100000, (process.getuid?.() ?? 0) + 1) })), RegistrationIdentityError);
  } finally { await fixture.cleanup(); }
});
test('bounded JSON rejects oversized/truncated/invalid UTF-8 and duplicate nested or escaped keys without echo', async () => {
  const fixture = await identityFixture();
  try {
    const file = path.join(fixture.directory, 'input.json');
    const bad: Array<string | Buffer> = ['{"code":"secret","code":"other"}', '{"a":{"v":1,"\\u0076":2}}',
      '{"a":', ' '.repeat(16385), Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d])];
    for (const input of bad) {
      await writeFile(file, input, { mode: 0o600 });
      await assert.rejects(() => readPrivateRegistrationJson(file), (error: unknown) => {
        assert.ok(error instanceof RegistrationIdentityError); assert.doesNotMatch(error.message, /secret|other/); return true;
      });
    }
    await writeFile(file, '{"a":{"same":1},"b":{"same":2},"strings":["{\\"x\\":1}","a:b"]}', { mode: 0o600 });
    assert.deepEqual(await readPrivateRegistrationJson(file), { a: { same: 1 }, b: { same: 2 }, strings: ['{"x":1}', 'a:b'] });
  } finally { await fixture.cleanup(); }
});
test('durable write stages use real files and retain the correct old/new value across failures', async () => {
  for (const fault of ['file-synced', 'before-rename', 'renamed', 'directory-synced'] as IdentityWriteStage[]) {
    const fixture = await identityFixture();
    try {
      const file = path.join(fixture.directory, 'target.json');
      await writeRegistrationIdentityJson(file, { previous: true });
      const stages: IdentityWriteStage[] = [];
      await assert.rejects(() => writeRegistrationIdentityJson(file, { next: true }, { stage: stage => {
        stages.push(stage); if (stage === fault) throw new Error('injected-storage-failure');
      } }), /injected-storage-failure/);
      const replaced = fault === 'renamed' || fault === 'directory-synced';
      assert.deepEqual(await readPrivateRegistrationJson(file), replaced ? { next: true } : { previous: true });
      assert.equal((await stat(file)).mode & 0o777, 0o600);
      assert.equal((await readdir(fixture.directory)).filter(name => name.endsWith('.tmp')).length, 0);
      assert.equal(stages.at(-1), fault);
    } finally { await fixture.cleanup(); }
  }
});
test('writer refuses unsafe targets or changed destination and never deletes foreign temporary files', async () => {
  const fixture = await identityFixture();
  try {
    const target = path.join(fixture.directory, 'target.json'), foreign = path.join(fixture.directory, '.foreign.tmp');
    await writeFile(foreign, 'do-not-remove', { mode: 0o600 });
    await symlink(fixture.config.enrollmentFile!, target);
    await assert.rejects(() => writeRegistrationIdentityJson(target, { next: true }), RegistrationIdentityError);
    const changed = path.join(fixture.directory, 'changed.json');
    await writeRegistrationIdentityJson(changed, { old: true });
    await assert.rejects(() => writeRegistrationIdentityJson(changed, { next: true }, { stage: async stage => {
      if (stage === 'before-rename') await writeFile(changed, '{"foreign":true}\n', { mode: 0o600 });
    } }), RegistrationIdentityError);
    assert.deepEqual(await readPrivateRegistrationJson(changed), { foreign: true });
    assert.equal(await readFile(foreign, 'utf8'), 'do-not-remove');
    const writableParent = path.join(fixture.directory, 'writable'); await mkdir(writableParent, { mode: 0o777 }); await chmod(writableParent, 0o777);
    await assert.rejects(() => writeRegistrationIdentityJson(path.join(writableParent, 'unsafe.json'), {}), RegistrationIdentityError);
  } finally { await fixture.cleanup(); }
});
