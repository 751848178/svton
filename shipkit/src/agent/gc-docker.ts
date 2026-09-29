// Injectable docker execution seam for GC (acceptance §B): production calls real `docker`;
// integration tests mock this module to simulate slow/broken daemons without touching real images.

import { exec, type ExecResult } from '../shared/exec.js';

export async function gcDockerRun(args: string[]): Promise<ExecResult> {
  return exec('docker', args, { timeoutMs: 90_000 });
}
