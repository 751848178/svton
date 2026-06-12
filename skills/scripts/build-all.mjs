import { buildSkill, listSkillNames, loadSkill } from './lib.mjs';

const skillNames = listSkillNames();
let hasErrors = false;

for (const skillName of skillNames) {
  const result = buildSkill(loadSkill(skillName));

  if (result.errors.length > 0) {
    hasErrors = true;
    console.error(`\n[build] ${skillName} failed`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    continue;
  }

  console.log(`[build] ${skillName} ok (${result.lineCount} lines)`);

  for (const warning of result.warnings) {
    console.warn(`  warning: ${warning}`);
  }
}

if (hasErrors) {
  process.exitCode = 1;
}
