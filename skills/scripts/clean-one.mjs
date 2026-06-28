import fs from 'node:fs';
import path from 'node:path';
import { loadSkill, repoRoot } from './lib.mjs';

const skillName = process.argv[2];

if (!skillName) {
  console.error('usage: node ./skills/scripts/clean-one.mjs <skill-name>');
  process.exit(1);
}

const { paths } = loadSkill(skillName);

for (const target of [
  path.join(paths.packageDir, 'dist'),
  path.join(repoRoot, '.skills', skillName),
]) {
  fs.rmSync(target, { recursive: true, force: true });
}

console.log(`[clean] ${skillName} ok`);
