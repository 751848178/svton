import { buildSkill, loadSkill } from './lib.mjs';

const skillName = process.argv[2];

if (!skillName) {
  console.error('usage: node ./skills/scripts/build-one.mjs <skill-name>');
  process.exit(1);
}

const result = buildSkill(loadSkill(skillName));

if (result.errors.length > 0) {
  console.error(`\n[build] ${skillName} failed`);
  for (const error of result.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`[build] ${skillName} ok (${result.lineCount} lines)`);

for (const warning of result.warnings) {
  console.warn(`  warning: ${warning}`);
}
