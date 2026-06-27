#!/usr/bin/env node

import { Command } from 'commander';
import { createProject } from './commands/create';
import { buildSkills, installSkill, listSkills } from './commands/skills';
import { dev, build, start, lint, typecheck, test, clean } from './commands/lifecycle';
import { info } from './commands/info';
import { doctor } from './commands/doctor';
import { envCheck } from './commands/env';
import { db } from './commands/db';
import { services } from './commands/services';
import { generate } from './commands/generate';
import { docker } from './commands/docker';
import { version } from '../package.json';

// 公共导出：供用户 svton.config.ts 使用
export { defineSvtonProject } from './config/schema';
export type { SvtonProjectConfig, SvtonAppConfig, AppType } from './config/types';

export async function cli() {
  const program = new Command();

  program
    .name('svton')
    .description('Svton CLI - Scaffold, run, and operate Svton full-stack projects')
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
    .option('--registry <url>', 'NPM registry for generated project and dependency install')
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

  // ---- 生命周期命令（委托 turbo / 包管理器） ----
  program
    .command('dev [target]')
    .description('Start dev servers (delegates to turbo run dev); optional app name')
    .action(dev);

  program
    .command('build [target]')
    .description('Build all or a single app (turbo run build)')
    .action(build);

  program
    .command('start [target]')
    .description('Start a production app (runs its own start script; not a turbo task)')
    .option('--all', 'Start every app that has a start script')
    .action(start);

  program
    .command('lint [target]')
    .description('Lint all or a single app (turbo run lint)')
    .option('--fix', 'Pass --fix through to the linters')
    .action(lint);

  program
    .command('typecheck [target]')
    .description('Type-check (turbo run type-check)')
    .action(typecheck);

  program
    .command('test [target]')
    .description('Run tests (turbo run test)')
    .action(test);

  program
    .command('clean')
    .description('Clean build outputs (and node_modules by default)')
    .option('--keep-deps', 'Keep node_modules')
    .action(clean);

  program
    .command('info')
    .description('Print the resolved Svton project manifest (apps, ports, db, services)')
    .option('--json', 'Emit the manifest as JSON')
    .action(info);

  program
    .command('doctor')
    .description('Run environment & project sanity checks')
    .option('--fix', 'Apply auto-fixable actions (e.g. create missing .env)')
    .action(doctor);

  const envCommand = program.command('env').description('Manage environment files');
  envCommand
    .command('check [target]')
    .description('Diff .env against .env.example (root and each app)')
    .option('--fix', 'Create missing .env from .env.example')
    .action(envCheck);
  envCommand
    .command('pull [target]')
    .description('Copy .env.example to .env')
    .action((target: string | undefined) => envCheck(target, { fix: true }));

  program
    .command('db <command>')
    .description('Run Prisma lifecycle (generate|migrate|migrate:deploy|studio|seed|init) in the database app')
    .option('--name <name>', 'Migration name (used by `migrate`)')
    .action(db);

  program
    .command('services <command>')
    .description('Manage local MySQL/Redis via docker compose (init|up|down|status)')
    .option('--force', 'init: overwrite an existing docker-compose.yml')
    .option('--volumes', 'down: also remove named volumes')
    .action(services);

  program
    .command('docker <command>')
    .description('Production Docker for svton projects — build inside the image (init|build|up|restart|down|logs|check)')
    .option('--force', 'init: overwrite generated files')
    .option('--template <root|per-app>', 'init: Dockerfile style (default root)', 'root')
    .option('--db <mysql|postgres|none>', 'init: database engine')
    .option('--mobile', 'init: enable mobile (taro) nginx service')
    .option('--no-mobile', 'init: disable mobile service')
    .option('--no-healthchecks', 'init: omit healthcheck blocks')
    .option('--service <name>', 'build/up/logs: operate on a single app')
    .option('--no-cache', 'build: docker build --no-cache')
    .option('--build-arg <k=v>', 'build: pass build arg (repeatable)', (v: string, acc: string[]) => { acc.push(v); return acc; }, [])
    .option('--tag <tag>', 'build --push: image tag (default git sha)')
    .option('--push', 'build: build then push (requires docker.image.registry)')
    .option('--profile <name>', 'up/down: compose profile (repeatable, default db)', (v: string, acc: string[]) => { acc.push(v); return acc; }, [])
    .option('--no-build', 'up: skip --build')
    .option('--build', 'restart: rebuild images and recreate containers')
    .option('--serial', 'build/up: build apps one at a time (lower peak memory on small servers)')
    .option('--no-serial', 'build/up: build in parallel (default)')
    .option('--volumes', 'down: also remove named volumes')
    .option('--rmi <all|local>', 'down: also remove images')
    .option('--tail <n>', 'logs: tail N lines', (v: string) => Number(v))
    .option('--file <path>', 'override prod compose file path')
    .action(docker);

  program
    .command('generate <kind> [name]')
    .alias('g')
    .description('Scaffold code (module | app | package | api-contract)')
    .option('--app <name>', 'Target app (needed when multiple apps match)')
    .option('--dry-run', 'Print the plan without writing files')
    .option('--force', 'Overwrite existing files')
    .action(generate);

  await program.parseAsync();
}

// Only run if this file is executed directly
// Skip this check in built version to avoid import.meta issues
if (require.main === module) {
  cli();
}
