// Build the single-file installer distribution: concatenate bootstrap/src/*.sh
// (lexical order) into bootstrap/install.sh so curl|bash and offline installs
// keep working while the SOURCE stays split by responsibility (M2 closure item).
// `--check` verifies the generated file is in sync — wired into `pnpm test` and
// run before every pack, so source and distribution cannot drift silently.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'bootstrap', 'src');
const outFile = path.join(root, 'bootstrap', 'install.sh');

export async function buildInstall() {
  const parts = (await readdir(srcDir)).filter((f) => f.endsWith('.sh')).sort();
  if (parts.length === 0) throw new Error(`no modules found in ${srcDir}`);
  const chunks = [];
  for (const part of parts) {
    let text = await readFile(path.join(srcDir, part), 'utf8');
    if (part === parts[0]) {
      if (!text.startsWith('#!/usr/bin/env bash')) throw new Error(`${part} must start with the shebang`);
    } else if (text.startsWith('#!')) {
      throw new Error(`${part} must not carry a shebang (only the first module may)`);
    }
    if (!text.endsWith('\n')) text += '\n';
    chunks.push(text);
  }
  return chunks.join('');
}

const isCheck = process.argv.includes('--check');
const generated = await buildInstall();
const current = await readFile(outFile, 'utf8').catch(() => null);
if (isCheck) {
  if (current !== generated) {
    console.error('bootstrap/install.sh is OUT OF SYNC with bootstrap/src/*.sh — run `node scripts/build-install.mjs` and commit the result');
    process.exit(1);
  }
  console.log('install.sh in sync with bootstrap/src');
} else {
  await writeFile(outFile, generated);
  console.log(`generated bootstrap/install.sh from ${((await readdir(srcDir)).filter((f) => f.endsWith('.sh'))).length} modules`);
}
