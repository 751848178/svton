// Apply side of the init writes (M1-06/M1-08/M1-09): conflict detection against
// files changed since planning, exclusive atomic writes, and rollback that is
// verified before the caller may claim "old files untouched".

import { chmod, copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { FilePlan, PlannedFile } from './write.js';
import { secureWrite, UnsafeTargetError } from '../../shared/secure-write.js';
import { withInitLock } from './lock.js';

/** a file changed (or appeared) between plan and apply — the plan is stale */
export class FileConflictError extends Error {
  constructor(readonly rels: string[]) {
    super(`以下文件在审阅后发生了变化（他人编辑或另一个 init 写入），已停止写入并保持原样：${rels.join('、')}。请重新运行 ship init 生成新计划。`);
  }
}

export type RollbackStatus = 'verified' | 'partial';

export class WriteFailedError extends Error {
  constructor(message: string, readonly rollback: RollbackStatus, readonly rollbackDetail: string) {
    super(message);
  }
}

export interface ApplyOutcome {
  wrote: string[];
  backups: string[];
}

function currentText(f: PlannedFile): string | null {
  try {
    return readFileSync(f.abs, 'utf8');
  } catch {
    return null;
  }
}

/** plan-time `before` must still match disk, or the plan is stale (M1-09) */
function detectConflicts(changed: PlannedFile[]): string[] {
  const conflicts: string[] = [];
  for (const f of changed) {
    if (currentText(f) !== f.before) conflicts.push(f.rel);
  }
  return conflicts;
}

/** rollback verification must match the REAL pre-run state (R5): a file that
 *  did not exist is restored by its absence; an existing file is restored only
 *  when both content and original mode match */
async function verifyRestored(f: PlannedFile): Promise<boolean> {
  try {
    if (f.before === null) return !existsSync(f.abs);
    const [text, mode] = await Promise.all([readFile(f.abs, 'utf8'), stat(f.abs)]);
    return text === f.before && (mode.mode & 0o777) === (f.beforeMode ?? f.mode);
  } catch {
    return false;
  }
}

async function restore(runDir: string, done: PlannedFile[]): Promise<{ status: RollbackStatus; detail: string }> {
  const failures: string[] = [];
  for (const f of done.reverse()) {
    try {
      const backup = path.join(runDir, f.rel.replace('/', '__'));
      if (f.before !== null) {
        await copyFile(backup, f.abs);
        await chmod(f.abs, f.beforeMode ?? f.mode);
      } else {
        await rm(f.abs, { force: true });
      }
      if (!(await verifyRestored(f))) failures.push(f.rel);
    } catch {
      failures.push(f.rel);
    }
  }
  return failures.length === 0
    ? { status: 'verified', detail: '' }
    : { status: 'partial', detail: `以下文件未能完全恢复：${failures.join('、')}（备份保留在 ${runDir}）` };
}

/** write all changed files under the project init lock; verified rollback on failure */
export async function applyFileWrites(cwd: string, plan: FilePlan): Promise<ApplyOutcome> {
  return withInitLock(cwd, async () => {
    const changed = plan.files.filter((f) => f.changed);
    if (changed.length === 0) return { wrote: [], backups: [] };
    const conflicts = detectConflicts(changed);
    if (conflicts.length > 0) throw new FileConflictError(conflicts);
    for (const f of changed) {
      if (lstatSync(f.abs, { throwIfNoEntry: false })?.isSymbolicLink()) {
        throw new UnsafeTargetError(f.abs);
      }
    }

    const runDir = path.join(cwd, '.ship', 'backup', String(Date.now()));
    const backups: string[] = [];
    const done: PlannedFile[] = [];
    try {
      await mkdir(runDir, { recursive: true });
      for (const f of changed) {
        if (f.before !== null) {
          const backup = path.join(runDir, f.rel.replace('/', '__'));
          await secureWrite(backup, f.before, 0o600);
          backups.push(backup);
        }
        await secureWrite(f.abs, f.after, f.mode);
        done.push(f);
      }
      return { wrote: changed.map((f) => f.rel), backups };
    } catch (e) {
      const firstError = e instanceof Error ? e.message : String(e);
      const { status, detail } = await restore(runDir, done);
      const message = status === 'verified'
        ? `写入失败，已回滚并逐文件校验，旧文件保持不变（备份在 ${runDir}）：${firstError}`
        : `写入失败，回滚仅部分成功：${detail}；原始错误：${firstError}`;
      throw new WriteFailedError(message, status, detail);
    }
  });
}
