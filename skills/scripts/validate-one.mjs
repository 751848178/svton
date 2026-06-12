import { loadSkill, validateSkill } from './lib.mjs';

const skillName = process.argv[2];

if (!skillName) {
  console.error('usage: node ./skills/scripts/validate-one.mjs <skill-name>');
  process.exit(1);
}

const result = validateSkill(loadSkill(skillName));

if (result.errors.length > 0) {
  console.error(`\n[validate] ${skillName} failed`);
  for (const error of result.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`[validate] ${skillName} ok (${result.lineCount} lines)`);

for (const warning of result.warnings) {
  console.warn(`  warning: ${warning}`);
}
