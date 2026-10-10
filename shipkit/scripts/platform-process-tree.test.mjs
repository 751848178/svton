import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acquireProcessLock } from './platform-process-lock.mjs';
import { spawnPlatformProcess, platformProcessStopped, stopPlatformProcesses, waitPlatformProcess } from './platform-process-tree.mjs';

test('stopping spawnSync command descendants ends writes before the maintenance lease is released', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'shipkit-subtree-'));
  const marker = path.join(root, 'writes');
  const writer = path.join(root, 'writer.cjs');
  const middle = path.join(root, 'migrate.cjs');
  let child, release;
  try {
    await writeFile(writer, 'const fs=require("node:fs");setInterval(()=>fs.appendFileSync(process.argv[2],"write\\n"),20);');
    await writeFile(middle, 'require("node:child_process").spawnSync(process.execPath,[process.argv[2],process.argv[3]],{stdio:"inherit"});');
    release = await acquireProcessLock(root);
    child = spawnPlatformProcess(process.execPath, [middle, writer, marker], { stdio: 'ignore' });
    for (let index = 0; index < 100; index++) {
      if (await readFile(marker, 'utf8').catch(() => '') !== '') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok((await readFile(marker, 'utf8')).length > 0);
    await assert.rejects(acquireProcessLock(root), /正在运行或维护/);
    assert.equal(await stopPlatformProcesses([child]), true);
    await waitPlatformProcess(child);
    assert.equal(platformProcessStopped(child), true);
    release(); release = undefined;
    const releaseNext = await acquireProcessLock(root);
    const after = await readFile(marker, 'utf8');
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(await readFile(marker, 'utf8'), after);
    releaseNext();
  } finally {
    if (child) await stopPlatformProcesses([child]);
    release?.();
    await rm(root, { recursive: true, force: true });
  }
});

test('normal completion includes process-group exit before returning its result', async () => {
  const child = spawnPlatformProcess(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
  assert.equal((await waitPlatformProcess(child)).code, 0);
  assert.equal(platformProcessStopped(child), true);
});

test('real bootstrap SIGTERM kills its spawnSync writer before another maintainer can acquire', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'shipkit-bootstrap-signal-'));
  const scripts = path.join(root, 'shipkit/scripts'), container = path.join(root, 'shipkit/ops/container');
  const app = path.join(root, 'apps/shipkit-api/scripts'), data = path.join(root, 'data');
  const marker = path.join(root, 'writes'), writer = path.join(root, 'writer.cjs');
  const pgid = path.join(root, 'group');
  let child;
  try {
    await Promise.all([scripts, container, app].map(directory => mkdir(directory, { recursive: true })));
    for (const file of ['platform-process-lock.mjs', 'platform-runtime-context.mjs', 'platform-process-tree.mjs', 'platform-supervisor-lifecycle.mjs']) {
      await copyFile(new URL(file, import.meta.url), path.join(scripts, file));
    }
    await copyFile(new URL('../ops/container/bootstrap.mjs', import.meta.url), path.join(container, 'bootstrap.mjs'));
    await writeFile(writer, 'const fs=require("node:fs");setInterval(()=>fs.appendFileSync(process.argv[2],"write\\n"),20);');
    await writeFile(path.join(app, 'migrate.mjs'), 'import {spawnSync} from "node:child_process";import {writeFileSync} from "node:fs";writeFileSync(process.env.QA_GROUP,String(process.pid));spawnSync(process.execPath,[process.env.QA_WRITER,process.env.QA_MARKER],{stdio:"inherit"});');
    child = spawnPlatformProcess(process.execPath, [path.join(container, 'bootstrap.mjs'), 'migrate'], {
      stdio: 'ignore', env: { ...process.env, SHIPKIT_DATA_DIR: data, QA_GROUP: pgid, QA_WRITER: writer, QA_MARKER: marker },
    });
    for (let index = 0; index < 100; index++) {
      if (await readFile(marker, 'utf8').catch(() => '') !== '') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok((await readFile(marker, 'utf8')).length > 0);
    child.kill('SIGTERM');
    assert.equal((await waitPlatformProcess(child)).code, 1);
    const releaseNext = await acquireProcessLock(data);
    const after = await readFile(marker, 'utf8');
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(await readFile(marker, 'utf8'), after);
    releaseNext();
  } finally {
    if (child) await stopPlatformProcesses([child]);
    try { process.kill(-Number(await readFile(pgid, 'utf8')), 'SIGKILL'); } catch {}
    await rm(root, { recursive: true, force: true });
  }
});
