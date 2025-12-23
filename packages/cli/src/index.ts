#!/usr/bin/env node

import { Command } from 'commander';
import { createProject } from './commands/create';
import { version } from '../package.json';

export function cli() {
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
    .action(createProject);

  program.parse();
}

// Only run if this file is executed directly
// Skip this check in built version to avoid import.meta issues
if (require.main === module) {
  cli();
}
