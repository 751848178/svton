import { listSkillNames, loadSkill, validateSkill } from './lib.mjs';

const skillNames = listSkillNames();
let hasErrors = false;

for (const skillName of skillNames) {
  const result = validateSkill(loadSkill(skillName));

  if (result.errors.length > 0) {
    hasErrors = true;
    console.error(`\n[validate] ${skillName} failed`);
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    continue;
  }

  console.log(`[validate] ${skillName} ok (${result.lineCount} lines)`);

  for (const warning of result.warnings) {
    console.warn(`  warning: ${warning}`);
  }
}

if (hasErrors) {
  process.exitCode = 1;
}
