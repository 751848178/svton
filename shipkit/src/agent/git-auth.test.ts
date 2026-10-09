import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createGitAuth } from '../shared/git-auth.js';
import { exec } from '../shared/exec.js';

for (const username of [undefined, 'gitlab+deploy-token-43', 'gitea.$(printf injected)']) {
  test(`actual askpass reads ${username === undefined ? 'default' : 'custom'} username from a private file without evaluating it`, async () => {
    const token = 'fake-read-token', expected = username ?? 'x-access-token';
    const auth = await createGitAuth(token, username);
    try {
      const usernameFile = auth.env.SHIPKIT_GIT_USERNAME_FILE!, script = auth.env.GIT_ASKPASS!;
      assert.equal(await readFile(usernameFile, 'utf8'), expected);
      assert.equal((await stat(usernameFile)).mode & 0o777, 0o600);
      assert.equal((await stat(path.dirname(usernameFile))).mode & 0o777, 0o700);
      const text = await readFile(script, 'utf8');
      assert.ok(!text.includes(expected) && !text.includes(token));
      assert.ok(!auth.gitArgs.join(' ').includes(expected));
      assert.ok(!Object.values(auth.env).includes(expected));
      const user = await exec('/bin/sh', [script, 'Username for repository'], { env: auth.env });
      const password = await exec('/bin/sh', [script, 'Password for repository'], { env: auth.env });
      assert.equal(user.code, 0); assert.equal(user.stdout, expected);
      assert.equal(password.code, 0); assert.equal(password.stdout, token);
    } finally { await auth.cleanup(); }
    await assert.rejects(() => stat(auth.env.SHIPKIT_GIT_USERNAME_FILE!), { code: 'ENOENT' });
    await assert.rejects(() => stat(auth.env.SHIPKIT_GIT_CREDENTIAL_FILE!), { code: 'ENOENT' });
  });
}

test('Git authentication rejects control characters and bounded-length violations before creating files', async () => {
  for (const username of ['', 'line\nname', 'line\rname', 'user\0name', 'user\tname', 'user\u007fname', 'user\u0085name', 'x'.repeat(257)]) {
    await assert.rejects(() => createGitAuth('fake-token', username), /username/);
  }
  for (const token of ['fake\nvalue', 'fake\tvalue', 'fake\0value', 'x'.repeat(16385)]) {
    await assert.rejects(() => createGitAuth(token), /credential/);
  }
});

test('Git child removes inherited curl verbosity without mutating the parent environment', async () => {
  const previous = process.env.GIT_CURL_VERBOSE;
  process.env.GIT_CURL_VERBOSE = '1';
  const auth = await createGitAuth('fake-token');
  try {
    const child = await exec(process.execPath, ['-e', 'process.stdout.write(JSON.stringify({verbose:process.env.GIT_CURL_VERBOSE ?? null,trace:process.env.GIT_TRACE_CURL}))'], { env: auth.env });
    assert.equal(child.code, 0);
    assert.deepEqual(JSON.parse(child.stdout), { verbose: null, trace: '0' });
    assert.equal(process.env.GIT_CURL_VERBOSE, '1');
  } finally {
    await auth.cleanup();
    if (previous === undefined) delete process.env.GIT_CURL_VERBOSE; else process.env.GIT_CURL_VERBOSE = previous;
  }
});
