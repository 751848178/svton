// Resume decision (M1-02/R4): which draft groups are still trustworthy compared
// to the files on disk. A completed draft is never resumed; an unfinished draft
// whose backing file changed since it was saved is dropped for that group.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { InitState } from './state.js';

export function fileFingerprint(abs: string | null): Promise<string | null> {
  if (!abs) return Promise.resolve(null);
  return readFile(abs, 'utf8')
    .then((text) => createHash('sha256').update(text).digest('hex'))
    .catch(() => null);
}

export interface ResumeDecision {
  useApp: boolean;
  useMachines: boolean;
  useRegistry: boolean;
  note?: string;
}

/** decide which draft groups are still trustworthy compared to the files on disk */
export async function resolveResume(
  prior: InitState | null,
  specPath: string | null,
  configPath: string | null,
): Promise<ResumeDecision> {
  if (!prior) return { useApp: false, useMachines: false, useRegistry: false };
  if (prior.step === 'done') {
    return {
      useApp: false, useMachines: false, useRegistry: false,
      note: '检测到已完成的 init 记录：本次默认值以现有配置文件为准，不再使用历史草稿。',
    };
  }
  const [specNow, configNow] = await Promise.all([fileFingerprint(specPath), fileFingerprint(configPath)]);
  const specChanged = prior.files?.spec !== undefined && prior.files.spec !== specNow;
  const configChanged = prior.files?.config !== undefined && prior.files.config !== configNow;
  const notes: string[] = [];
  if (configChanged) notes.push('控制器配置在草稿保存后发生了变化，机器/仓库默认值改用当前配置文件');
  if (specChanged) notes.push('应用配置在草稿保存后发生了变化，应用默认值改用当前配置文件');
  return {
    useApp: !specChanged,
    useMachines: !configChanged,
    useRegistry: !configChanged,
    note: notes.length > 0 ? `检测到未完成的 init 进度，但${notes.join('；')}。` : undefined,
  };
}
