import { open } from 'node:fs/promises';
import { statSync, unlinkSync } from 'node:fs';
import path from 'node:path';

// A shared exclusive lease prevents platform startup during offline maintenance.
export async function acquireProcessLock(dataRoot) {
  const filename = path.join(dataRoot, '.ops.lock');
  let handle;
  try { handle = await open(filename, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Shipkit 数据目录正在运行或维护；请先停止服务。遗留锁需核实进程退出后人工清理。');
    throw error;
  }
  const identity = await handle.stat();
  await handle.writeFile(JSON.stringify({ pid: process.pid, purpose: 'platform' }));
  await handle.close();
  return () => {
    try {
      const current = statSync(filename);
      if (current.ino === identity.ino && current.dev === identity.dev) unlinkSync(filename);
    } catch {}
  };
}
