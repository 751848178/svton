import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { runAndStream, spawnStreaming, PackageManager } from '../utils/exec';
import { findProjectRoot } from '../utils/project-root';
import { loadManifest } from '../config/loader';
import { SvtonProjectConfig } from '../config/types';

/** svton 命令名 → turbo 任务名（`typecheck` 别名到连字符的 `type-check`）。 */
const TASK_ALIAS: Record<string, string> = {
  typecheck: 'type-check',
};

export interface LifecycleOptions {
  fix?: boolean;
  keepDeps?: boolean;
  all?: boolean;
}

interface AppPkg {
  name?: string;
  scripts?: Record<string, string>;
}

async function readAppPkg(root: string, appDir: string): Promise<AppPkg | null> {
  const pkgPath = path.join(root, appDir, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return null;
  try {
    return await fs.readJSON(pkgPath);
  } catch {
    return null;
  }
}

/** 解析 app 名称（带 scope，用于 turbo `--filter`）。 */
async function appPackageName(root: string, appDir: string): Promise<string> {
  const pkg = await readAppPkg(root, appDir);
  return pkg?.name ?? appDir;
}

async function rootHasScript(root: string, script: string): Promise<boolean> {
  const pkgPath = path.join(root, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return false;
  try {
    const pkg = await fs.readJSON(pkgPath);
    return Boolean(pkg?.scripts && script in pkg.scripts);
  } catch {
    return false;
  }
}

/** 把 svton 命令名归一为 turbo 任务名。 */
export function resolveTask(commandTask: string): string {
  return TASK_ALIAS[commandTask] ?? commandTask;
}

/**
 * 运行一个 turbo 任务（dev/build/lint/type-check/test/clean）。
 * - 无 target：优先走根 `package.json` 的同名脚本（即项目自己接的 turbo），否则 `<pm> exec turbo run`。
 * - 有 target：`<pm> exec turbo run <task> --filter=<pkg>`（尊重 pipeline 依赖与 persistent）。
 */
export async function runTurboTask(
  commandTask: string,
  target: string | undefined,
  options: { extraArgs?: string[] } = {},
): Promise<void> {
  const root = await findProjectRoot();
  const manifest = await loadManifest(root);
  const pm: PackageManager = manifest.pm ?? 'pnpm';
  const task = resolveTask(commandTask);

  if (target) {
    const app = manifest.apps[target];
    if (!app) {
      logger.error(`Unknown app: ${target}`);
      logger.info(`Available: ${Object.keys(manifest.apps).join(', ')}`);
      process.exit(1);
    }
    const name = await appPackageName(root, app.dir);
    await runAndStream(pm, ['exec', 'turbo', 'run', task, `--filter=${name}`, ...(options.extraArgs ?? [])], {
      cwd: root,
    });
    return;
  }

  // 全量：优先根脚本，回退 turbo exec
  if (await rootHasScript(root, task)) {
    await runAndStream(pm, ['run', task, ...(options.extraArgs ?? [])], { cwd: root });
  } else {
    await runAndStream(pm, ['exec', 'turbo', 'run', task, ...(options.extraArgs ?? [])], { cwd: root });
  }
}

/** `start` 不是 turbo 任务：在 app 目录内直接跑它的 `start` 脚本。 */
async function runAppScript(
  manifest: SvtonProjectConfig,
  root: string,
  script: string,
  appKey: string,
): Promise<void> {
  const app = manifest.apps[appKey];
  const pkg = await readAppPkg(root, app.dir);
  if (!pkg?.scripts || !(script in pkg.scripts)) {
    logger.error(`App "${appKey}" has no "${script}" script.`);
    process.exit(1);
  }
  const pm: PackageManager = manifest.pm ?? 'pnpm';
  logger.info(`Starting ${appKey} (${script}) …`);
  await spawnStreaming(pm, ['run', script], { cwd: path.join(root, app.dir) });
}

/** 找出所有拥有某脚本的 app。 */
async function appsWithScript(
  manifest: SvtonProjectConfig,
  root: string,
  script: string,
): Promise<string[]> {
  const out: string[] = [];
  for (const [key, app] of Object.entries(manifest.apps)) {
    const pkg = await readAppPkg(root, app.dir);
    if (pkg?.scripts && script in pkg.scripts) out.push(key);
  }
  return out;
}

// ---- 命令 action ----

export async function dev(target?: string): Promise<void> {
  await runTurboTask('dev', target);
}

export async function build(target?: string): Promise<void> {
  await runTurboTask('build', target);
}

export async function lint(target: string | undefined, options: LifecycleOptions = {}): Promise<void> {
  await runTurboTask('lint', target, options.fix ? { extraArgs: ['--', '--fix'] } : {});
}

export async function typecheck(target?: string): Promise<void> {
  await runTurboTask('typecheck', target);
}

export async function test(target?: string): Promise<void> {
  await runTurboTask('test', target);
}

export async function clean(options: LifecycleOptions = {}): Promise<void> {
  await runTurboTask('clean', undefined);
  if (!options.keepDeps) {
    const root = await findProjectRoot();
    logger.info('Removing node_modules …');
    await fs.remove(path.join(root, 'node_modules'));
  }
}

export async function start(target: string | undefined, options: LifecycleOptions = {}): Promise<void> {
  const root = await findProjectRoot();
  const manifest = await loadManifest(root);
  const candidates = await appsWithScript(manifest, root, 'start');

  if (candidates.length === 0) {
    logger.error('No app exposes a "start" script.');
    process.exit(1);
  }

  if (target) {
    await runAppScript(manifest, root, 'start', target);
    return;
  }

  if (options.all) {
    for (const key of candidates) {
      await runAppScript(manifest, root, 'start', key);
    }
    return;
  }

  if (candidates.length === 1) {
    await runAppScript(manifest, root, 'start', candidates[0]);
    return;
  }

  logger.error('Multiple apps have a "start" script. Specify one, or use --all.');
  logger.info(`Candidates: ${candidates.join(', ')}`);
  process.exit(1);
}
