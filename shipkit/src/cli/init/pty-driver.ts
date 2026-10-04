// Shared pty driver for the interactive regressions: an expect script is
// written to a temp file (never fed via stdin — an errored stdin script makes
// expect drop into its interactive REPL and wedge the test runner) and the
// spawned expect is always SIGKILLed once the CAPTURED marker shows up or the
// hard timeout fires.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function ptyAvailable(): boolean {
  return process.platform === 'darwin' && existsSync('/usr/bin/expect');
}

export interface ExpectRunOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

/** the script must eventually `puts "CAPTURED:..."`; returns the captured output */
export async function runExpectScript(script: string, opts: ExpectRunOptions = {}): Promise<string> {
  if (!ptyAvailable()) throw new Error('pty driver unavailable on this platform');
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-pty-'));
  try {
    const file = path.join(dir, 'driver.exp');
    await writeFile(file, script.endsWith('\n') ? script : `${script}\n`, 'utf8');
    return await new Promise<string>((resolve, reject) => {
      const c = spawn('/usr/bin/expect', ['-f', file], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
      });
      let out = '';
      let settled = false;
      const finish = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        c.kill('SIGKILL');
        fn();
      };
      const timer = setTimeout(
        () => finish(() => reject(new Error(`pty run timed out; output tail: ${out.slice(-600)}`))),
        opts.timeoutMs ?? 60_000,
      );
      const check = (): void => {
        if (out.includes('CAPTURED:')) finish(() => resolve(out));
      };
      c.stdout.on('data', (d) => { out += d; check(); });
      c.stderr.on('data', (d) => { out += d; });
      c.on('exit', () => finish(() => (
        out.includes('CAPTURED:')
          ? resolve(out)
          : reject(new Error(`expect exited before capturing; output tail: ${out.slice(-600)}`))
      )));
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
