#!/usr/bin/env node

import { Command } from 'commander';
import { createProject } from './commands/create';
import { buildSkills, installSkill, listSkills } from './commands/skills';
import { version } from '../package.json';

export async function cli() {
  const program = new Command();

  program
    .name('svton')
    .description('Svton CLI - Create full-stack applications with NestJS, Next.js, and Taro')
    .version(version);

  // svton create <project-name> - 创建新项目
  program
    .command('create <project-name>')
    .alias('init')
    .alias('new')
    .description('Create a new Svton project')
    .option('-o, --org <name>', 'Organization name (default: project name)')
    .option('--skip-install', 'Skip installing dependencies')
    .option('--skip-git', 'Skip Git initialization')
    .option('-t, --template <template>', 'Template to use', 'full-stack')
    .option('-p, --package-manager <pm>', 'Package manager to use', 'pnpm')
    .option('-y, --yes', 'Skip all prompts and use defaults')
    .action(createProject);

  const skillCommand = program
    .command('skill')
    .alias('skills')
    .description('Install, build, and list AI agent skills');

  skillCommand
    .command('install [source]')
    .description('Install a skill from a local directory, Git repository, SKILL.md URL, or SkillHub')
    .option('--source-dir <path>', 'Local skill directory, or source subdirectory inside --repo')
    .option('--repo <url>', 'Git repository containing one or more skills')
    .option('--ref <ref>', 'Git branch, tag, or commit to clone')
    .option('--url <url>', 'Direct URL to a SKILL.md file')
    .option('--hub <url>', 'SkillHub-compatible base URL (defaults to skills.sh when --skill is used)')
    .option('--skill <id>', 'SkillHub skill id, for example owner/repo/skill-name')
    .option('--out-dir <path>', 'Target skill directory', '.svton/skills')
    .option('--force', 'Overwrite an existing skill with the same name')
    .option('-y, --yes', 'Skip prompts and require command-line options')
    .action(installSkill);

  skillCommand
    .command('build [skill]')
    .description('Build skills from a source skills directory into AI agent skill artifacts')
    .option('--skills-dir <path>', 'Directory containing source skill folders', 'skills')
    .option('--out-dir <path>', 'Target built skill directory', '.svton/skills')
    .option('--clean', 'Remove the target directory before building')
    .action(buildSkills);

  skillCommand
    .command('list')
    .description('List built or installed skills')
    .option('--out-dir <path>', 'Skill directory to inspect', '.svton/skills')
    .action(listSkills);

  await program.parseAsync();
}

// Only run if this file is executed directly
// Skip this check in built version to avoid import.meta issues
if (require.main === module) {
  cli();
}
