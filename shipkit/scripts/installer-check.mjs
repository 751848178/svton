// Persistent installer regressions (M2-01/M2-02/M2-09) — run by `pnpm test`.
// Model: the audit's independent harness. bootstrap/install.sh is relocated into
// a temp root and external boundaries are replaced by recorded stubs:
//   id → root · apt-get → unavailable · sleep → no-op · journalctl → empty
//   systemctl → records calls; a successful restart reports the version of the
//   tree in /opt/shipkit (OLD_AGENT → 0.3.0, NEW_AGENT → per-scenario)
//   curl → prints the version the last successful restart produced; file://
//          downloads work so the BUNDLE_BASE path is exercised
// sha256sum is REAL in every scenario (integrity semantics under test).
// This validates script branching and file transactions only — it is NOT a
// Debian/systemd real-machine acceptance.

import { mkdtemp, mkdir, readFile, writeFile, chmod, readdir, stat, copyFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = await readFile(path.join(REPO, 'bootstrap', 'install.sh'), 'utf8');
const run = (cmd, args, opts) => new Promise((resolve) => {
  execFile(cmd, args, opts, (err, stdout, stderr) => resolve({ code: err ? (err.code ?? 1) : 0, stdout, stderr }));
});

const results = [];
async function scenario(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: String(e.message ?? e) });
    console.log(`FAIL ${name}: ${e.message ?? e}`);
  }
}

function check(cond, msg) { if (!cond) throw new Error(msg); }

const OLD_ENV = 'SHIP_AGENT_TOKEN=OLD_TOKEN\nSHIP_PUSH_USER=oldpush\nSHIP_PUSH_PASSWORD=OLD_PUSH_PW\n';
// work roots are RELATIVE to the relocated root (mkdir must never touch real /srv)
const OLD_UNIT = (d) => [
  'Environment=SHIP_AGENT_ROLE=runtime',
  'Environment=SHIP_AGENT_PORT=17410',
  'Environment=SHIP_AGENT_HOST=127.0.0.1',
  `Environment=SHIP_WORK_ROOT=${d}/srv/old-root`,
].join('\n');

/** build one relocated install site with stubs and an old installation */
async function site(newAgentVersion = '0.4.0', { oldInstall = true } = {}) {
  const d = await mkdtemp(path.join('/tmp', 'ship-instcheck-'));
  for (const p of ['opt/shipkit/agent', 'etc/shipkit', 'etc/systemd/system', 'tmp', 'bin', 'payload/agent', 'payload2/agent']) {
    await mkdir(path.join(d, p), { recursive: true });
  }
  if (oldInstall) {
    await writeFile(path.join(d, 'opt/shipkit/agent/server.js'), 'OLD_AGENT');
    await writeFile(path.join(d, 'opt/shipkit/VERSION'), '0.3.0\n');
    await writeFile(path.join(d, 'etc/shipkit/agent.env'), OLD_ENV);
    await writeFile(path.join(d, 'etc/systemd/system/ship-agent.service'), OLD_UNIT(d));
  }
  await writeFile(path.join(d, 'payload/agent/server.js'), 'NEW_AGENT');
  await writeFile(path.join(d, 'payload/VERSION'), '0.4.0\n');
  await writeFile(path.join(d, 'payload2/agent/server.js'), 'NEW_AGENT2');
  await writeFile(path.join(d, 'payload2/VERSION'), '0.4.1\n');
  const tgz = path.join(d, 'input.tgz');
  await run('tar', ['czf', tgz, '-C', path.join(d, 'payload'), '.']);
  const tgz2 = path.join(d, 'input2.tgz');
  await run('tar', ['czf', tgz2, '-C', path.join(d, 'payload2'), '.']);
  const sha = async (f) => createHash('sha256').update(await readFile(f)).digest('hex');

  const shim = async (name, text) => {
    const p = path.join(d, 'bin', name);
    await writeFile(p, `#!/bin/sh\n${text}\n`);
    await chmod(p, 0o755);
  };
  await shim('id', 'echo 0');
  await shim('apt-get', 'exit 93');
  await shim('sleep', 'exit 0');
  await shim('journalctl', 'exit 0');
  await shim('curl', [
    '# health probe: report what the last successful restart produced',
    'if [ "$1" = "-fsS" ]; then V=$(cat ' + d + '/state-version 2>/dev/null || true); [ -n "$V" ] && echo "{\\"version\\":\\"$V\\"}" || exit 1; exit 0; fi',
    '# downloads: support the relocated file:// bundle base and curl -o semantics',
    'OUT="" URL="" PREV=""',
    'for a in "$@"; do',
    '  if [ "$PREV" = "-o" ]; then OUT="$a"; PREV=""; continue; fi',
    '  case "$a" in file://*) URL="$a" ;; esac',
    '  PREV="$a"',
    'done',
    '[ -n "$URL" ] || exit 1',
    'SRC="${URL#file://}"',
    'if [ -n "$OUT" ]; then cat "$SRC" > "$OUT"; else cat "$SRC"; fi',
    'exit 0',
  ].join('\n'));
  await shim('systemctl', [
    'CMD="$1"',
    'case "$CMD" in',
    '  daemon-reload|enable) exit 0 ;;',
    '  restart)',
    `    if [ -f ${d}/restart-exit-all ]; then exit "$(cat ${d}/restart-exit-all)"; fi`,
    `    if [ -f ${d}/restart-exit ]; then N=$(cat ${d}/restart-count 2>/dev/null || echo 0); N=$((N+1)); echo $N > ${d}/restart-count; [ "$N" -le 1 ] && exit "$(cat ${d}/restart-exit)"; fi`,
    `    S=$(cat ${d}/opt/shipkit/agent/server.js 2>/dev/null || echo NONE)`,
    '    case "$S" in',
    `      *OLD_AGENT*) echo 0.3.0 > ${d}/state-version ;;`,
    `      *NEW_AGENT2*) echo 0.4.1 > ${d}/state-version ;;`,
    `      *NEW_AGENT*) V="$(cat ${d}/new-agent-version 2>/dev/null || echo 0.4.0)"; [ -n "$V" ] && echo "$V" > ${d}/state-version || rm -f ${d}/state-version ;;`,
    `      *) rm -f ${d}/state-version ;;`,
    '    esac',
    '    exit 0 ;;',
    'esac',
    'exit 0',
  ].join('\n'));
  await writeFile(path.join(d, 'new-agent-version'), `${newAgentVersion}\n`);

  const adapted = SOURCE
    .replaceAll('/tmp/', `${d}/tmp/`)
    .replaceAll('/opt/shipkit-data', `${d}/opt/shipkit-data`)
    .replaceAll('/opt/shipkit', `${d}/opt/shipkit`)
    .replaceAll('/etc/shipkit', `${d}/etc/shipkit`)
    .replaceAll('/etc/systemd/system', `${d}/etc/systemd/system`);
  const script = path.join(d, 'install.sh');
  await writeFile(script, adapted);

  const execWith = (tarball, env = {}) => run('bash', [script], {
    env: Object.fromEntries(Object.entries({
      PATH: `${d}/bin:${process.env.PATH}`, SKIP_DOCKER: '1', TARBALL: tarball,
      ...env, SKIP_SYSTEMD: env.SKIP_SYSTEMD ?? '0',
    }).filter(([, v]) => v !== undefined)),
    timeout: 60_000,
  });
  return {
    d, script, tgz, tgz2, sha,
    exec: (env) => execWith(tgz, env),
    execWith,
    read: async (rel) => readFile(path.join(d, rel), 'utf8'),
    exists: async (rel) => stat(path.join(d, rel)).then(() => true, () => false),
  };
}

// ---- M2-02: upgrade transactions ----

await scenario('M2-02 health-mismatch: exit 4, program/env/unit ALL restored, rollback version-verified', async () => {
  const s = await site('0.3.0'); // new agent reports the wrong (old) version
  const r = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz) });
  check(r.code === 4, `exit ${r.code} (stdout tail: ${r.stdout.slice(-400)})`);
  check((await s.read('opt/shipkit/agent/server.js')) === 'OLD_AGENT', 'program tree restored');
  check((await s.read('etc/shipkit/agent.env')) === OLD_ENV, 'agent.env restored');
  check((await s.read('etc/systemd/system/ship-agent.service')) === OLD_UNIT(s.d), 'unit restored');
  check(r.stdout.includes('rollback verified'), `rollback must be verified, got: ${r.stdout.slice(-300)}`);
  check(await s.exists('opt/shipkit.failed'), 'failed tree kept for inspection');
});

await scenario('M2-02 restart-failure: exit 4 (was: no rollback at all), everything restored', async () => {
  const s = await site();
  await writeFile(path.join(s.d, 'restart-exit'), '7\n');
  const r = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz) });
  check(r.code === 4, `exit ${r.code} (tail: ${r.stdout.slice(-300)})`);
  check((await s.read('opt/shipkit/agent/server.js')) === 'OLD_AGENT', 'old tree restored');
  check((await s.read('etc/shipkit/agent.env')) === OLD_ENV, 'env restored');
  check((await s.read('etc/systemd/system/ship-agent.service')) === OLD_UNIT(s.d), 'unit restored');
});

await scenario('M2-02 health-timeout: rollback verified against the old version → exit 4', async () => {
  const s = await site(''); // new agent never becomes healthy; the old one does
  const r = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz) });
  check(r.code === 4, `exit ${r.code} (tail: ${r.stdout.slice(-300)})`);
  check((await s.read('opt/shipkit/agent/server.js')) === 'OLD_AGENT', 'old tree restored');
});

await scenario('M2-02 rollback itself fails → exit 5 with an explicit incomplete-rollback report', async () => {
  const s = await site('');
  await writeFile(path.join(s.d, 'restart-exit-all'), '9\n'); // restart fails even during rollback
  const r = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz) });
  check(r.code === 5, `exit ${r.code}`);
  check(r.stderr.includes('rollback INCOMPLETE'), `stderr must name the incomplete rollback: ${r.stderr.slice(-200)}`);
});

await scenario('M2-02 no-override upgrade preserves runtime role/port/workroot/token (exit 0)', async () => {
  const s = await site();
  const r = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz) });
  check(r.code === 0, `exit ${r.code} (tail: ${r.stdout.slice(-300)})`);
  check((await s.read('opt/shipkit/agent/server.js')) === 'NEW_AGENT', 'new tree live');
  check((await s.read('etc/shipkit/agent.env')).includes('SHIP_AGENT_TOKEN=OLD_TOKEN'), 'token preserved');
  const unit = await s.read('etc/systemd/system/ship-agent.service');
  check(unit.includes('SHIP_AGENT_ROLE=runtime') && unit.includes('SHIP_AGENT_PORT=17410') && unit.includes(`SHIP_WORK_ROOT=${s.d}/srv/old-root`), 'unit keeps role/port/workroot');
  check(!(await s.exists('opt/shipkit.old')), 'no leftover .old after a healthy upgrade');
});

await scenario('M2-01 explicit overrides + fresh install (no previous tree) commits the requested values', async () => {
  const s = await site('0.4.0', { oldInstall: false });
  const r = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz), ROLE: 'builder', AGENT_TOKEN: 'NEW_FRESH', AGENT_PORT: '17500', WORK_ROOT: `${s.d}/srv/fresh` });
  check(r.code === 0, `exit ${r.code} (tail: ${r.stdout.slice(-300)})`);
  check((await s.read('etc/shipkit/agent.env')).includes('SHIP_AGENT_TOKEN=NEW_FRESH'), 'token from env');
  const unit = await s.read('etc/systemd/system/ship-agent.service');
  check(unit.includes('SHIP_AGENT_ROLE=builder') && unit.includes('SHIP_AGENT_PORT=17500') && unit.includes(`SHIP_WORK_ROOT=${s.d}/srv/fresh`), 'unit carries the requested role/port/workroot');
});

// ---- M2-R1: commit-phase failures all route into the rollback ----

await scenario('M2-R1 workroot-is-file: refused pre-swap, NOTHING changed (exit 1)', async () => {
  const s = await site();
  await writeFile(path.join(s.d, 'afile'), 'not a directory');
  const r = await s.exec({ WORK_ROOT: path.join(s.d, 'afile') });
  check(r.code === 1, `exit ${r.code}`);
  check((await s.read('opt/shipkit/agent/server.js')) === 'OLD_AGENT', 'program untouched');
  check((await s.read('etc/shipkit/agent.env')) === OLD_ENV, 'env untouched');
  check((await s.read('etc/systemd/system/ship-agent.service')) === OLD_UNIT(s.d), 'unit untouched');
  check(!(await s.exists('opt/shipkit.old')), 'no .old created');
  check(!(await s.exists('opt/shipkit.new')), 'staging cleaned by the EXIT trap');
  check(r.stderr.includes('not a directory'), `must name the conflict: ${r.stderr.slice(-160)}`);
});

await scenario('M2-R1 chmod failure after env write → rollback verified (exit 4)', async () => {
  const s = await site();
  await writeFile(path.join(s.d, 'bin/chmod'), '#!/bin/sh\nexit 9\n');
  await chmod(path.join(s.d, 'bin/chmod'), 0o755);
  const r = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz) });
  check(r.code === 4, `exit ${r.code}`);
  check((await s.read('opt/shipkit/agent/server.js')) === 'OLD_AGENT', 'program restored');
  check((await s.read('etc/shipkit/agent.env')) === OLD_ENV, 'env restored (was the newly written one)');
  check((await s.read('etc/systemd/system/ship-agent.service')) === OLD_UNIT(s.d), 'unit restored (never overwritten)');
  check(r.stdout.includes('rollback verified'), 'rollback must be verified, not assumed');
});

await scenario('M2-R1 commit-phase mkdir failure (preflight passed) → rollback (exit 4)', async () => {
  const s = await site();
  // mkdir succeeds during preflight AND bundle staging (calls 1-2); the commit-region call fails
  await writeFile(path.join(s.d, 'bin/mkdir'), `#!/bin/sh\nN=$(cat ${s.d}/mkdir-count 2>/dev/null || echo 0); N=$((N+1)); echo $N > ${s.d}/mkdir-count; [ "$N" -ge 3 ] && exit 1; exec /bin/mkdir "$@"\n`);
  await chmod(path.join(s.d, 'bin/mkdir'), 0o755);
  const r = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz) });
  check(r.code === 4, `exit ${r.code}`);
  check((await s.read('opt/shipkit/agent/server.js')) === 'OLD_AGENT', 'program restored');
  check((await s.read('etc/shipkit/agent.env')) === OLD_ENV, 'env restored');
});

await scenario('M2-R1 program swap failure mid-transaction → rollback (exit 4)', async () => {
  const s = await site();
  // mv fails only when moving the staged tree into place
  await writeFile(path.join(s.d, 'bin/mv'), `#!/bin/sh\ncase "$*" in *"${s.d}/opt/shipkit.new"*) exit 1;; esac\nexec /bin/mv "$@"\n`);
  await chmod(path.join(s.d, 'bin/mv'), 0o755);
  const r = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz) });
  check(r.code === 4, `exit ${r.code}`);
  check((await s.read('opt/shipkit/agent/server.js')) === 'OLD_AGENT', 'original tree back in place');
  check((await s.read('etc/shipkit/agent.env')) === OLD_ENV, 'env restored');
});

// ---- M2-09: checksum source priority (REAL sha256sum everywhere) ----

await scenario('M2-09 explicit wrong hash vs correct sidecar → hard conflict, exit 3 (was: exit 0 "verified")', async () => {
  const s = await site();
  const good = await s.sha(s.tgz);
  await writeFile(`${s.tgz}.sha256`, `${good}  ship-agent.tgz\n`);
  const r = await s.exec({ TARBALL_SHA256: '0'.repeat(64) });
  check(r.code === 3, `exit ${r.code}`);
  check(r.stderr.includes('conflict'), `must name the source conflict: ${r.stderr.slice(-200)}`);
  check((await s.read('opt/shipkit/agent/server.js')) === 'OLD_AGENT', 'installation untouched');
});

await scenario('M2-09 explicit hash + agreeing sidecar installs (source named as explicit)', async () => {
  const s = await site();
  const good = await s.sha(s.tgz);
  await writeFile(`${s.tgz}.sha256`, `${good}  ship-agent.tgz\n`);
  const r = await s.exec({ TARBALL_SHA256: good });
  check(r.code === 0, `exit ${r.code} (tail: ${r.stdout.slice(-300)})`);
  check(r.stdout.includes('source: explicit'), 'explicit source must be named when both agree');
});

await scenario('M2-09 corrupt sidecar without an explicit hash → refused', async () => {
  const s = await site();
  await writeFile(`${s.tgz}.sha256`, 'not-a-hash\n');
  const r = await s.exec({});
  check(r.code === 3, `exit ${r.code} (tail: ${r.stderr.slice(-200)})`);
});

await scenario('M2-09 invalid explicit hash format → parameter error before anything else', async () => {
  const s = await site();
  const r = await s.exec({ TARBALL_SHA256: 'abc123' });
  check(r.code === 1, `exit ${r.code}`);
  check(r.stderr.includes('64 hex'), `stderr: ${r.stderr.slice(-160)}`);
});

await scenario('M2-09 no checksum source → warning, install still proceeds', async () => {
  const s = await site();
  const r = await s.exec({});
  check(r.stdout.includes('WARNING: no checksum source'), r.stdout.slice(-200));
});

await scenario('M2-09 per-install isolation: no fixed /tmp/ship-sums, no cross-run residue; second run verifies its own bundle', async () => {
  const s = await site();
  const first = await s.exec({ TARBALL_SHA256: await s.sha(s.tgz) });
  check(first.code === 0, `first exit ${first.code}`);
  // second upgrade with a DIFFERENT bundle and its own explicit hash
  const second = await s.execWith(s.tgz2, { TARBALL_SHA256: await s.sha(s.tgz2) });
  check(second.code === 0, `second exit ${second.code} (tail: ${second.stdout.slice(-300)})`);
  check((await s.read('opt/shipkit/VERSION')).trim() === '0.4.1', 'second bundle is the live one');
  const tmpEntries = await readdir(path.join(s.d, 'tmp'));
  const residue = tmpEntries.filter((f) => f.startsWith('ship-sums') || f.startsWith('ship-agent.'));
  check(residue.length === 0, `no fixed/leftover checksum or tarball temp files (found: ${residue.join(',')})`);
});

await scenario('M2-09 download path: SHA256SUMS verified; wrong remote sums refused; explicit-vs-remote conflict refused', async () => {
  const s = await site();
  const bundleDir = path.join(s.d, 'bundle');
  await mkdir(bundleDir, { recursive: true });
  await copyFile(s.tgz, path.join(bundleDir, 'agent.tgz'));
  const good = await s.sha(s.tgz);
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), `${good}  agent.tgz\n`);
  const runBundle = (sums) => s.execWith('', { BUNDLE_BASE: `file://${bundleDir}`, ...(sums ? { TARBALL_SHA256: sums } : {}) });
  const ok = await runBundle();
  check(ok.code === 4 || ok.code === 0, `valid SHA256SUMS should install, exit ${ok.code} (tail: ${ok.stdout.slice(-200)})`);
  await writeFile(path.join(bundleDir, 'SHA256SUMS'), `${'0'.repeat(64)}  agent.tgz\n`);
  const bad = await runBundle();
  check(bad.code === 3, `wrong remote sums must be refused, exit ${bad.code}`);
  const conflict = await runBundle(good);
  check(conflict.code === 3, `explicit vs wrong remote sums is a conflict, exit ${conflict.code}`);
});

const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0
  ? `installer-check: ${results.length}/${results.length} scenarios passed`
  : `installer-check: ${results.length - failed.length}/${results.length} passed — FAILED: ${failed.map((f) => f.name).join('; ')}`);
process.exit(failed.length === 0 ? 0 : 1);
