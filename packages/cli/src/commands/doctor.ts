import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { findProjectRoot } from '../utils/project-root';
import { loadManifest, locateConfig } from '../config/loader';
import { collectEnvIssues } from './env';
import { isPortFree } from '../utils/ports';
import { isDockerAvailable } from '../utils/docker';
import { SvtonProjectConfig } from '../config/types';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

interface Ctx {
  root: string;
  manifest: SvtonProjectConfig;
  rootPkg: any;
  hasConfigFile: boolean;
}

async function runCommand(cmd: string): Promise<string | null> {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

const EXPECTED_SCRIPTS: Record<string, string[]> = {
  next: ['dev', 'build', 'start', 'lint', 'type-check'],
  nest: ['dev', 'build', 'start', 'lint', 'type-check', 'test'],
  taro: ['dev', 'lint', 'type-check'],
  node: ['dev'],
};

// ---- 单项检查 ----

async function checkNode(): Promise<CheckResult> {
  const major = Number(process.versions.node.split('.')[0]);
  return {
    name: 'Node.js',
    status: major >= 18 ? 'pass' : 'fail',
    detail: `v${process.versions.node} (requires >=18)`,
  };
}

async function checkPm(ctx: Ctx): Promise<CheckResult> {
  const pm = ctx.manifest.pm ?? 'pnpm';
  const version = await runCommand(`${pm} --version`);
  const pinned = ctx.rootPkg?.packageManager as string | undefined;
  if (!version) return { name: 'Package manager', status: 'fail', detail: `${pm} not found` };
  if (pinned && pinned.startsWith(pm)) {
    return { name: 'Package manager', status: 'pass', detail: `${pm}@${version} (pinned ${pinned})` };
  }
  return { name: 'Package manager', status: 'warn', detail: `${pm}@${version} (packageManager: ${pinned ?? 'unset'})` };
}

async function checkTurbo(ctx: Ctx): Promise<CheckResult> {
  const inDeps = Boolean(ctx.rootPkg?.devDependencies?.turbo || ctx.rootPkg?.dependencies?.turbo);
  const version = await runCommand('turbo --version');
  if (version) return { name: 'Turborepo', status: 'pass', detail: `v${version}` };
  if (inDeps) return { name: 'Turborepo', status: 'pass', detail: 'present in devDependencies (run via pnpm exec turbo)' };
  return { name: 'Turborepo', status: 'fail', detail: 'not found' };
}

async function checkManifest(ctx: Ctx): Promise<CheckResult> {
  if (ctx.hasConfigFile) {
    return { name: 'Manifest', status: 'pass', detail: 'svton.config.* loaded & schema valid' };
  }
  return { name: 'Manifest', status: 'info', detail: 'none — using auto-detection' };
}

async function checkScriptContract(ctx: Ctx): Promise<CheckResult> {
  const problems: string[] = [];
  for (const [name, app] of Object.entries(ctx.manifest.apps)) {
    const pkgPath = path.join(ctx.root, app.dir, 'package.json');
    if (!(await fs.pathExists(pkgPath))) {
      problems.push(`${name}: package.json missing`);
      continue;
    }
    const pkg = await fs.readJSON(pkgPath);
    const scripts = pkg?.scripts ?? {};
    const expected = EXPECTED_SCRIPTS[app.type] ?? [];
    const missing = expected.filter((s) => !(s in scripts));
    if (missing.length) problems.push(`${name} (${app.type}): missing ${missing.join(',')}`);
  }
  if (problems.length === 0) return { name: 'Script contract', status: 'pass', detail: 'all apps expose expected scripts' };
  return { name: 'Script contract', status: 'warn', detail: problems.join('; ') };
}

async function checkEnv(ctx: Ctx): Promise<CheckResult> {
  const issues = await collectEnvIssues(ctx.root, ctx.manifest);
  if (issues.length === 0) return { name: 'Env files', status: 'info', detail: 'no .env.example found' };
  const missingEnv = issues.filter((i) => !i.envExists);
  const missingKeys = issues.filter((i) => i.envExists && i.missing.length);
  if (missingEnv.length === 0 && missingKeys.length === 0) {
    return { name: 'Env files', status: 'pass', detail: `${issues.length} env file(s) up to date` };
  }
  const bits: string[] = [];
  if (missingEnv.length) bits.push(`${missingEnv.map((i) => i.dir).join(',')} missing .env`);
  if (missingKeys.length) bits.push(`${missingKeys.reduce((n, i) => n + i.missing.length, 0)} key(s) missing`);
  return { name: 'Env files', status: 'fail', detail: bits.join('; ') };
}

async function checkDatabaseUrl(ctx: Ctx): Promise<CheckResult> {
  if (!ctx.manifest.database) return { name: 'Database URL', status: 'info', detail: 'no database configured' };
  const dirs = ['.', ctx.manifest.database.dir];
  for (const dir of dirs) {
    for (const f of ['.env', '.env.local']) {
      const p = path.join(ctx.root, dir, f);
      if (!(await fs.pathExists(p))) continue;
      const text = await fs.readFile(p, 'utf8');
      const m = text.match(/^DATABASE_URL\s*=\s*["']?([^"'\s]+)/m);
      if (m) {
        const host = m[1];
        const isLocal = /@(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/.test(host) || host.startsWith('file:');
        return {
          name: 'Database URL',
          status: isLocal ? 'pass' : 'warn',
          detail: isLocal ? 'local datasource' : `points to remote host (${host.split('@').pop()}) — db migrate will run against it`,
        };
      }
    }
  }
  return { name: 'Database URL', status: 'warn', detail: 'DATABASE_URL not set' };
}

async function checkPrismaClient(ctx: Ctx): Promise<CheckResult> {
  if (!ctx.manifest.database) return { name: 'Prisma client', status: 'info', detail: 'no database configured' };
  const candidates = [
    path.join(ctx.root, ctx.manifest.database.dir, 'node_modules', '.prisma', 'client'),
    path.join(ctx.root, 'node_modules', '.prisma', 'client'),
    path.join(ctx.root, ctx.manifest.database.dir, 'node_modules', '@prisma', 'client'),
  ];
  for (const c of candidates) {
    if (await fs.pathExists(c)) return { name: 'Prisma client', status: 'pass', detail: 'generated' };
  }
  return { name: 'Prisma client', status: 'warn', detail: 'not generated — run `svton db generate`' };
}

async function checkPorts(ctx: Ctx): Promise<CheckResult> {
  const portApps = Object.entries(ctx.manifest.apps).filter(([, a]) => a.port);
  if (portApps.length === 0) return { name: 'Ports', status: 'info', detail: 'no HTTP apps' };
  const inUse: string[] = [];
  for (const [name, app] of portApps) {
    if (app.port && !(await isPortFree(app.port))) inUse.push(`${name}:${app.port}`);
  }
  if (inUse.length === 0) return { name: 'Ports', status: 'pass', detail: 'all app ports free' };
  return { name: 'Ports', status: 'warn', detail: `in use (likely running): ${inUse.join(', ')}` };
}

async function checkDocker(): Promise<CheckResult> {
  return isDockerAvailable()
    ? { name: 'Docker', status: 'pass', detail: 'available (for `svton services`)' }
    : { name: 'Docker', status: 'info', detail: 'not found (optional, for services)' };
}

const CHECKS: Array<(ctx: Ctx) => Promise<CheckResult>> = [
  (_ctx) => checkNode(),
  checkPm,
  checkTurbo,
  checkManifest,
  checkScriptContract,
  checkEnv,
  checkDatabaseUrl,
  checkPrismaClient,
  checkPorts,
  (_ctx) => checkDocker(),
];

function statusLabel(status: CheckStatus): string {
  switch (status) {
    case 'pass':
      return chalk.green('✓ pass');
    case 'warn':
      return chalk.yellow('! warn');
    case 'fail':
      return chalk.red('✗ fail');
    case 'info':
      return chalk.gray('· info');
  }
}

export interface DoctorOptions {
  fix?: boolean;
}

/** `svton doctor` action。 */
export async function doctor(options: DoctorOptions = {}): Promise<void> {
  const root = await findProjectRoot();
  const manifest = await loadManifest(root);
  const rootPkgPath = path.join(root, 'package.json');
  const rootPkg = (await fs.pathExists(rootPkgPath)) ? await fs.readJSON(rootPkgPath) : {};
  const hasConfigFile = Boolean(await locateConfig(root));

  const ctx: Ctx = { root, manifest, rootPkg, hasConfigFile };

  logger.info(chalk.bold(`Svton doctor @ ${root}\n`));

  let fails = 0;
  let warns = 0;
  for (const check of CHECKS) {
    const result = await check(ctx);
    const name = result.name.padEnd(18);
    logger.info(`  ${statusLabel(result.status).padEnd(14)} ${name} ${chalk.gray(result.detail)}`);
    if (result.status === 'fail') fails++;
    if (result.status === 'warn') warns++;
  }

  logger.info('');
  if (options.fix) {
    // 当前 --fix 仅自动补 .env（db generate 在 Phase 3）
    const { envCheck } = await import('./env');
    logger.info(chalk.bold('Applying fixes …'));
    await envCheck(undefined, { fix: true });
  }

  if (fails > 0) {
    logger.error(`\n${fails} failing check(s), ${warns} warning(s).`);
    process.exitCode = 1;
  } else if (warns > 0) {
    logger.warn(`\nOK with ${warns} warning(s).`);
  } else {
    logger.success('\nAll checks passed.');
  }
}
