// M2-01 regression: the REAL bundle server renders an install script whose
// parameter resolution keeps the four-layer priority (env > existing install >
// rendered template > built-in default). The renderer replaces the template
// sentinels but can no longer rewrite the sentinel comparisons into value
// comparisons (the original both/7410 bug).

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startBundleServer } from './bundle-server.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW_INSTALL = path.join(REPO, 'bootstrap', 'install.sh');

function runBash(file: string, env: Record<string, string | undefined>): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const clean = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined)) as Record<string, string>;
    const c = spawn('bash', [file], { env: { PATH: process.env.PATH ?? '', ...clean } });
    let output = '';
    c.stdout.on('data', (d) => { output += d; });
    c.stderr.on('data', (d) => { output += d; });
    c.on('close', (code) => resolve({ code: code ?? -1, output }));
  });
}

/** cut the script at the package-manager step and print the resolved parameters */
async function resolutionHarness(scriptText: string, dir: string, token: string): Promise<string> {
  const prefix = (scriptText.split('# ---- package manager ----')[0] ?? '')
    .replace('INSTALL_DIR=/opt/shipkit', `INSTALL_DIR=${dir}/opt/shipkit`)
    .replace('SECRETS_FILE=/etc/shipkit/agent.env', `SECRETS_FILE=${dir}/etc/shipkit/agent.env`)
    .replace('UNIT_FILE=/etc/systemd/system/ship-agent.service', `UNIT_FILE=${dir}/etc/systemd/system/ship-agent.service`)
    // M2-R1 preflight probes the write conditions BEFORE the swap: relocate those
    // paths too so the harness still exercises resolution only, never the real fs
    .replaceAll('/opt/shipkit-data', `${dir}/opt/shipkit-data`)
    .replaceAll(' /etc/shipkit', ` ${dir}/etc/shipkit`)
    .replaceAll(' /etc/systemd/system', ` ${dir}/etc/systemd/system`)
    .replace('[ "$(id -u)" = 0 ]', '[ 0 = 0 ]');
  await mkdir(path.join(dir, 'etc/systemd/system'), { recursive: true }); // preflight write-probe target
  const file = path.join(dir, 'prefix.sh');
  await writeFile(file, `${prefix}\nprintf 'ROLE=%s PORT=%s BIND=%s WORK=%s TOKEN_OK=%s\\n' "$ROLE" "$AGENT_PORT" "$AGENT_BIND" "$WORK_ROOT" "$([ "$AGENT_TOKEN" = "${token}" ] && echo yes || echo no)"\n`);
  return file;
}

test('M2-01: rendered script keeps template token/role/port; sentinel comparisons survive rendering', async () => {
  const distDir = path.join(REPO, 'dist');
  const bundle = await startBundleServer({ distDir, bootstrapDir: path.join(REPO, 'bootstrap'), advertiseHost: '127.0.0.1', port: 0 });
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-m2render-'));
  try {
    const text = await (await fetch(bundle.installUrl('builder'))).text();
    // the renderer substituted the template slots…
    assert.ok(text.includes(`ROLE_TPL='builder'`));
    assert.ok(text.includes(`AGENT_PORT_TPL='7410'`), 'agent port must not inherit the bundle listener port');
    assert.ok(text.includes(`AGENT_TOKEN_TPL='${bundle.tokens.builder}'`));
    // …but the runtime-built sentinel comparison is untouched
    assert.ok(text.includes(`printf '__%s__'`), 'sentinel helper must survive rendering');
    assert.ok(!/"\$ROLE" = "builder"/.test(text), 'no value-vs-value placeholder comparison may remain');

    // fresh machine, no env: template values win
    const fresh = await runBash(await resolutionHarness(text, dir, bundle.tokens.builder), { TARBALL: 'x' });
    assert.equal(fresh.code, 0, fresh.output);
    // the default WORK_ROOT is relocated by the harness — assert it resolves to the
    // built-in default LAYER (dir-prefixed), not to a template/env value
    assert.match(fresh.output, new RegExp(`ROLE=builder PORT=7410 BIND=0\\.0\\.0\\.0 WORK=${dir}/opt/shipkit-data TOKEN_OK=yes`));

    // explicit env beats the template (WORK_ROOT relocated: preflight probes writability)
    const envDir = path.join(dir, 'e');
    const envWins = await runBash(await resolutionHarness(text, envDir, bundle.tokens.builder), {
      TARBALL: 'x', ROLE: 'runtime', AGENT_PORT: '17412', AGENT_BIND: '127.0.0.1', WORK_ROOT: `${envDir}/data/w`, AGENT_TOKEN: 'MY_OWN',
    });
    assert.equal(envWins.code, 0, envWins.output);
    assert.match(envWins.output, new RegExp(`ROLE=runtime PORT=17412 BIND=127\\.0\\.0\\.1 WORK=${envDir}/data/w TOKEN_OK=no`));

    // existing install beats the template (upgrade preserves the machine's own values)
    const up = path.join(dir, 'up');
    const unitDir = path.join(up, 'etc/systemd/system');
    const secretsDir = path.join(up, 'etc/shipkit');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(unitDir, { recursive: true });
    await mkdir(secretsDir, { recursive: true });
    await writeFile(path.join(unitDir, 'ship-agent.service'), [
      'Environment=SHIP_AGENT_ROLE=runtime',
      'Environment=SHIP_AGENT_PORT=17410',
      'Environment=SHIP_AGENT_HOST=10.0.0.9',
      `Environment=SHIP_WORK_ROOT=${up}/srv/old`,
    ].join('\n'));
    await writeFile(path.join(secretsDir, 'agent.env'), 'SHIP_AGENT_TOKEN=OLD_MACHINE_TOKEN\n');
    const upgrade = await runBash(await resolutionHarness(text, up, 'OLD_MACHINE_TOKEN'), { TARBALL: 'x' });
    assert.equal(upgrade.code, 0, upgrade.output);
    assert.match(upgrade.output, new RegExp(`ROLE=runtime PORT=17410 BIND=10\\.0\\.0\\.9 WORK=${up}/srv/old TOKEN_OK=yes`));
  } finally {
    await bundle.stop();
  }
});

test('M2-01: RAW script (manual download, no rendering) preserves an existing runtime install', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-m2raw-'));
  const { mkdir } = await import('node:fs/promises');
  const unitDir = path.join(dir, 'etc/systemd/system');
  const secretsDir = path.join(dir, 'etc/shipkit');
  await mkdir(unitDir, { recursive: true });
  await mkdir(secretsDir, { recursive: true });
  await writeFile(path.join(unitDir, 'ship-agent.service'), 'Environment=SHIP_AGENT_ROLE=runtime\nEnvironment=SHIP_AGENT_PORT=17410\n');
  await writeFile(path.join(secretsDir, 'agent.env'), 'SHIP_AGENT_TOKEN=OLD_RUNTIME_TOKEN\n');
  const raw = await readFile(RAW_INSTALL, 'utf8');
  // raw script still carries every sentinel — the upgrade must keep the unit's values
  const file = await resolutionHarness(raw, dir, 'OLD_RUNTIME_TOKEN');
  const out = await runBash(file, { TARBALL: 'x' });
  assert.equal(out.code, 0, out.output);
  assert.match(out.output, /ROLE=runtime PORT=17410/);
  // and a raw FRESH run without any token fails clearly instead of defaulting
  const freshDir = await mkdtemp(path.join(tmpdir(), 'ship-m2raw-'));
  const fresh = await resolutionHarness(raw, freshDir, '-');
  const r = await runBash(fresh, { TARBALL: 'x' });
  assert.notEqual(r.code, 0);
  assert.match(r.output, /AGENT_TOKEN not set/);
});
