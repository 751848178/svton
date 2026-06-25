import spawn from 'cross-spawn';
import { execSync } from 'child_process';
import { logger } from './logger';

export interface SpawnOptions {
  cwd?: string;
  /** 默认 inherit，把子进程 IO 直接接到当前终端。 */
  stdio?: 'inherit' | 'pipe' | 'ignore';
  env?: NodeJS.ProcessEnv;
}

/**
 * 运行长驻/流式命令（如 `dev`、`start`、`prisma studio`）。
 *
 * 使用 cross-spawn 保证 Windows 下 `.cmd`/SIGINT 的可靠性，并把父进程收到的
 * SIGINT/SIGTERM 转发给子进程，确保 Ctrl-C 能干净退出。
 *
 * 返回子进程退出码；非零时 reject。
 */
export function spawnStreaming(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: options.stdio ?? 'inherit',
      env: { ...process.env, ...options.env },
    });

    const forward = (signal: NodeJS.Signals) => {
      try {
        child.kill(signal);
      } catch {
        /* 子进程可能已退出 */
      }
    };
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);

    child.on('error', (err) => {
      process.removeListener('SIGINT', forward);
      process.removeListener('SIGTERM', forward);
      reject(err);
    });

    child.on('close', (code) => {
      process.removeListener('SIGINT', forward);
      process.removeListener('SIGTERM', forward);
      if (code === 0) resolve(0);
      else reject(new Error(`Command \`${command} ${args.join(' ')}\` exited with code ${code}`));
    });
  });
}

/**
 * 运行一次性命令（如 `prisma generate`）。失败时抛错。
 * 等价 execSync(cmd, { stdio: 'inherit', cwd })，集中在此便于统一行为。
 */
export function runSync(command: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): void {
  execSync(command, {
    cwd: options.cwd ?? process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
  });
}

/** 命令是否可用（如 `docker --version`）。不可用返回 false，不抛错。 */
export function isCommandAvailable(command: string): boolean {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execSync(`${command} version`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

/** 包管理器命令名。 */
export type PackageManager = 'pnpm' | 'npm' | 'yarn';

/** 把 `<pm>` 解析为实际可执行命令；pnpm/npm/yarn 名称与命令一致。 */
export function pmBin(pm: PackageManager): string {
  return pm;
}

/** 打印将要运行的命令（调试可见）并执行 spawnStreaming。 */
export async function runAndStream(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): Promise<void> {
  logger.debug(`$ ${command} ${args.join(' ')}`);
  await spawnStreaming(command, args, options);
}
