import { spawn } from 'node:child_process';

// Own a POSIX process group so pnpm/Prisma descendants share shutdown policy.
const exits = new WeakMap();
export function spawnPlatformProcess(command, args, options) {
  if (process.platform === 'win32') throw new Error('Platform supervision requires POSIX process groups');
  const child = spawn(command, args, { ...options, detached: true });
  exits.set(child, new Promise((resolve) => {
    child.once('error', () => resolve({ code: 1 }));
    child.once('exit', (code, signal) => resolve({ code, signal }));
  }));
  return child;
}
export function platformProcessStopped(child) {
  if (!child.pid) return true;
  try { process.kill(-child.pid, 0); return false; }
  catch (error) { return error.code === 'ESRCH'; }
}
const delay = () => new Promise((resolve) => setTimeout(resolve, 25));
async function groupsStopped(children, timeout) {
  const deadline = Date.now() + timeout;
  do {
    if (children.every(platformProcessStopped)) return true;
    await delay();
  } while (Date.now() < deadline);
  return children.every(platformProcessStopped);
}
function signalGroup(child, signal) {
  if (!child.pid || platformProcessStopped(child)) return;
  try { process.kill(-child.pid, signal); } catch {}
}
export async function stopPlatformProcesses(children, { termMs = 5000, killMs = 5000 } = {}) {
  for (const child of children) signalGroup(child, 'SIGTERM');
  if (await groupsStopped(children, termMs)) return true;
  for (const child of children) signalGroup(child, 'SIGKILL');
  return await groupsStopped(children, killMs);
}
export async function waitPlatformProcess(child) {
  const result = await exits.get(child);
  if (!await groupsStopped([child], 5000)) throw new Error('Command exited while descendants remain active');
  return result;
}
