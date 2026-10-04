// Build a versioned local installable tarball: CLI + agent dist + bootstrap resources.
// Local-distribution artifact only (never published); install with:
//   npm install --prefix <dir> shipkit-<version>.tgz
// npm pack would otherwise exclude dist/ via .gitignore, so we stage an explicit layout.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const stage = path.join(root, '.pack-stage');
const outDir = path.join(root, 'pack');

// regenerate the single-file installer from bootstrap/src so the shipped
// artifact can never drift from the maintained modules (M2 closure item)
execFileSync('node', [path.join(root, 'scripts', 'build-install.mjs')], { stdio: 'inherit' });

const distAgent = path.join(root, 'dist', 'agent', 'server.js');
if (!existsSync(distAgent)) {
  console.error('dist missing — run `pnpm --filter shipkit build` first (expected dist/agent/server.js)');
  process.exit(2);
}
for (const res of ['bootstrap/install.sh', 'bootstrap/ship-agent.service', 'bootstrap/caddy']) {
  if (!existsSync(path.join(root, res))) {
    console.error(`bootstrap resource missing: ${res}`);
    process.exit(2);
  }
}

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const item of ['dist', 'bootstrap', 'examples', 'ship.config.example.yaml', 'README.md']) {
  cpSync(path.join(root, item), path.join(stage, item), { recursive: true });
}
// same layout as the repo root, so resolveShipkitRoot() keeps working inside node_modules
writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  private: true,
  description: pkg.description,
  type: 'module',
  bin: pkg.bin,
  engines: pkg.engines,
  dependencies: pkg.dependencies,
}, null, 2));

mkdirSync(outDir, { recursive: true });
const tarball = execFileSync('npm', ['pack', '--pack-destination', outDir], { cwd: stage, encoding: 'utf8' }).trim();
console.log(`packed: ${path.join(outDir, tarball)}`);

// manual-transfer agent bundle (UX05): dist + VERSION + minimal package.json, plus checksum
const agentStage = path.join(root, '.pack-stage', 'agent-bundle');
rmSync(agentStage, { recursive: true, force: true });
mkdirSync(agentStage, { recursive: true });
cpSync(path.join(root, 'dist', '.'), agentStage, { recursive: true }); // same layout the bundle server serves
writeFileSync(path.join(agentStage, 'VERSION'), `${pkg.version}\n`);
writeFileSync(path.join(agentStage, 'package.json'), JSON.stringify({ name: 'shipkit-agent', version: pkg.version, private: true, type: 'module' }, null, 2));
const agentTgz = path.join(outDir, `ship-agent-${pkg.version}.tgz`);
execFileSync('tar', ['czf', agentTgz, '-C', agentStage, '.']);
const sha = createHash('sha256').update(readFileSync(agentTgz)).digest('hex');
writeFileSync(`${agentTgz}.sha256`, `${sha}  ship-agent-${pkg.version}.tgz\n`);
console.log(`agent bundle: ${agentTgz} (sha256 ${sha.slice(0, 16)}…)`);
console.log('local artifact only — not published to any registry');
