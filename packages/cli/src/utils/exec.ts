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

export interface ParallelCommand {
  name: string;
  command: string;
  args: string[];
  cwd: string;
}

/** 给一个流加逐行前缀(如 `[backend] `),便于多进程并行时区分输出。 */
function prefixStream(prefix: string, src: NodeJS.ReadableStream, dest: NodeJS.WritableStream): void {
  let buf = '';
  src.on('data', (chunk: Buffer) => {
    buf += chunk.toString();
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      dest.write(`${prefix}${buf.slice(0, idx)}\n`);
      buf = buf.slice(idx + 1);
    }
  });
  src.on('end', () => {
    if (buf.length) dest.write(`${prefix}${buf}\n`);
  });
}

/**
 * 并行运行多个长驻命令(如同时 `start` 多个 app)。
 * 每个进程的输出按 `[name] ` 前缀分流到 stdout/stderr;父进程收到 SIGINT/SIGTERM
 * 时转发给所有子进程。任一子进程退出则全部终止;全部退出(0)后 resolve。
 */
export async function spawnParallel(commands: ParallelCommand[]): Promise<void> {
  if (commands.length === 0) return;
  const children = commands.map((c) => {
    const ch = spawn(c.command, c.args, {
      cwd: c.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    const prefix = `[${c.name}] `;
    if (ch.stdout) prefixStream(prefix, ch.stdout, process.stdout);
    if (ch.stderr) prefixStream(prefix, ch.stderr, process.stderr);
    return ch;
  });

  const killAll = (signal: NodeJS.Signals) => {
    for (const ch of children) {
      try {
        ch.kill(signal);
      } catch {
        /* 已退出 */
      }
    }
  };
  process.on('SIGINT', killAll);
  process.on('SIGTERM', killAll);

  await new Promise<void>((resolve) => {
    let remaining = children.length;
    let exited = false;
    const onExit = () => {
      if (exited) return;
      exited = true;
      process.removeListener('SIGINT', killAll);
      process.removeListener('SIGTERM', killAll);
      killAll('SIGTERM'); // 任一退出 → 收尾其余
      resolve();
    };
    for (const ch of children) {
      ch.on('close', () => {
        if (--remaining === 0) {
          process.removeListener('SIGINT', killAll);
          process.removeListener('SIGTERM', killAll);
          resolve();
        } else {
          onExit();
        }
      });
      ch.on('error', onExit);
    }
  });
}
