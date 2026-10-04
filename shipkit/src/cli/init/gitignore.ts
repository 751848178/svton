// Git ignore planning for secret-bearing files (M1-03/R2): git's EFFECTIVE
// verdict (`git check-ignore`) is authoritative — a same-name line that a later
// negation defeats does not count as protection. When the file is not actually
// ignored, the rule is appended at the END of .gitignore (last match wins) and
// the conflict is surfaced, never silently declared fixed. An already-tracked
// file gets an explicit untrack-and-rotate warning: an ignore rule cannot undo
// a committed credential.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface IgnoreStatus {
  inRepo: boolean;
  ignored: boolean;
  tracked: boolean;
}

export interface IgnorePlan extends IgnoreStatus {
  before: string | null;
  after: string;
  /** .gitignore must be created/updated so the wanted paths are really ignored */
  changeNeeded: boolean;
  /** an existing same-name entry was defeated by a later negation — appended at end (R2) */
  negationFix: boolean;
}

function git(cwd: string, args: string[]): number | null {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status;
}

export function ignoreStatus(cwd: string, rel: string): IgnoreStatus {
  const inRepo = git(cwd, ['rev-parse', '--is-inside-work-tree']) === 0;
  if (!inRepo) return { inRepo: false, ignored: false, tracked: false };
  return {
    inRepo: true,
    ignored: git(cwd, ['check-ignore', '-q', rel]) === 0,
    tracked: git(cwd, ['ls-files', '--error-unmatch', rel]) === 0,
  };
}

function appendLines(before: string | null, lines: string[]): string {
  const base = before === null || before === '' ? '' : before.replace(/\n*$/, '\n');
  return `${base}${lines.join('\n')}\n`;
}

/** plan .gitignore so that `.ship/` and the secret config file are ignored for real */
export function planSecretIgnore(cwd: string, secretRel: string): IgnorePlan {
  const giAbs = path.join(cwd, '.gitignore');
  let before: string | null = null;
  try {
    before = readFileSync(giAbs, 'utf8');
  } catch {
    before = null; // absent
  }
  const status = ignoreStatus(cwd, secretRel);
  const lines = new Set((before ?? '').split('\n').map((l) => l.trim()));
  const wanted: string[] = [];
  for (const rel of ['.ship/', secretRel]) {
    // in a repo, only git's own (negation-aware) verdict counts as covered (R2);
    // outside git the textual line is the best available signal
    const covered = status.inRepo ? ignoreStatus(cwd, rel).ignored : lines.has(rel);
    if (!covered) wanted.push(rel);
  }
  const after = wanted.length === 0 ? (before ?? '') : appendLines(before, wanted);
  return {
    before,
    after,
    changeNeeded: (before ?? '') !== after,
    negationFix: wanted.includes(secretRel) && lines.has(secretRel),
    ...status,
  };
}

/** post-write recheck (R2): git's own verdict; null when git cannot judge */
export function verifySecretIgnored(cwd: string, rel: string): boolean | null {
  const st = ignoreStatus(cwd, rel);
  if (!st.inRepo || st.tracked) return null;
  return st.ignored;
}
