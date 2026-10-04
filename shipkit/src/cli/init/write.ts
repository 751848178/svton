// Planning side of the init writes (M1-01/M1-03/M1-05/M1-09): which files, in
// which format, with masked display previews and ignore-rule coverage. Planning
// never touches disk — apply.ts owns writes, conflict detection and rollback.

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  buildConfigObject, buildSpecObject, mergeConfig, mergeSpec,
  renderYaml, serialize, validateConfigText, validateSpecText,
  type FileFormat, type InitAnswers,
} from './plan.js';
import { maskObject } from './mask.js';
import { ignoreStatus, planSecretIgnore } from './gitignore.js';

export interface PlannedFile {
  rel: string;
  abs: string;
  format: FileFormat | 'text';
  secret: boolean;
  before: string | null;
  /** on-disk mode at plan time; used by apply's rollback verification (R5) and
   *  by the permission requirement: a secret file with wrong mode is a change (R3) */
  beforeMode: number | null;
  after: string;
  /** display-only views (secrets masked at the object level); null when the raw
   *  original must not be shown (absent or unparsable — M1-01) */
  beforePreview: string | null;
  afterPreview: string;
  mode: number;
  changed: boolean;
  /** existing file exists but does not parse — its content will be replaced (and backed up) */
  existingInvalid: boolean;
}

export interface FilePlan {
  files: PlannedFile[];
  /** surfaced in review and the final result (tracked secret config, unignored env file…) */
  warnings: string[];
}

export interface ExistingPaths {
  specPath?: string | null;
  configPath?: string | null;
}

function readIfExists(abs: string): string | null {
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return null; // absent, a directory, or unreadable
  }
}

function safeParse(text: string | null): unknown {
  if (text === null) return null;
  try {
    return yaml.load(text);
  } catch {
    return null;
  }
}

function formatOf(abs: string): FileFormat {
  return abs.endsWith('.json') ? 'json' : 'yaml';
}

/** structured (yaml/json) file: previews are masked re-serializations of the parsed objects */
function plannedStructured(rel: string, abs: string, before: string | null, afterObj: Record<string, unknown>, mode: number, secret: boolean, validate: (text: string) => void): PlannedFile {
  const format = formatOf(abs);
  const beforeObj = safeParse(before);
  const existingInvalid = before !== null && beforeObj === null;
  const after = serialize(afterObj, format);
  validate(after); // exact serialized text passes the shared validator before anything is written
  const maskedPreview = (obj: Record<string, unknown>): string => serialize(maskObject(obj), format);
  let beforeMode: number | null = null;
  try {
    beforeMode = statSync(abs).mode & 0o777;
  } catch {
    beforeMode = null; // absent
  }
  return {
    rel, abs, format, secret,
    before, after, beforeMode,
    beforePreview: beforeObj === null || !beforeObj ? null : maskedPreview(beforeObj as Record<string, unknown>),
    afterPreview: maskedPreview(afterObj),
    mode,
    // a secret file with the wrong mode is a change even when the text matches (R3)
    changed: before !== after || (secret && beforeMode !== null && beforeMode !== mode),
    existingInvalid,
  };
}

/** raw-text file (.gitignore): content is its own preview */
function plannedText(rel: string, abs: string, before: string | null, after: string, mode: number): PlannedFile {
  return {
    rel, abs, format: 'text', secret: false,
    before, after, beforePreview: before, afterPreview: after,
    mode, beforeMode: null, changed: before !== after, existingInvalid: false,
  };
}

export function planFileWrites(cwd: string, answers: InitAnswers, existing: ExistingPaths = {}): FilePlan {
  const specRel = existing.specPath ? path.basename(existing.specPath) : 'ship.yaml';
  const configRel = existing.configPath ? path.basename(existing.configPath) : 'ship.config.yaml';

  const specBefore = readIfExists(path.join(cwd, specRel));
  const configBefore = readIfExists(path.join(cwd, configRel));
  // merge into the file actually in use (M1-05): user fields, other targets and
  // source survive; the original path/format keeps its precedence instead of
  // being shadowed by a brand-new ship.yaml
  const specMerged = mergeSpec(safeParse(specBefore), buildSpecObject(answers));
  const configMerged = mergeConfig(safeParse(configBefore), buildConfigObject(answers));

  const files: PlannedFile[] = [
    plannedStructured(specRel, path.join(cwd, specRel), specBefore, specMerged, 0o644, false, validateSpecText),
    plannedStructured(configRel, path.join(cwd, configRel), configBefore, configMerged, 0o600, true, validateConfigText),
  ];

  const warnings: string[] = [];
  const ignore = planSecretIgnore(cwd, configRel);
  if (ignore.tracked) {
    warnings.push(`${configRel} 已被 Git 跟踪，忽略规则无法移除已提交的历史；请执行 git rm --cached ${configRel} 并轮换该 token，再提交。`);
  }
  if (ignore.negationFix) {
    warnings.push(`检测到 .gitignore 中的否定规则使 ${configRel} 的忽略条目失效；已把 ${configRel} 追加到文件末尾（末条规则优先生效），提交前请复核 .gitignore。`);
  }
  if (ignore.changeNeeded) {
    files.push(plannedText('.gitignore', path.join(cwd, '.gitignore'), ignore.before, ignore.after, 0o644));
  }

  if (answers.envFile && existsSync(path.join(cwd, answers.envFile))) {
    const st = ignoreStatus(cwd, answers.envFile);
    if (st.inRepo && !st.ignored && !st.tracked) {
      warnings.push(`运行时环境文件 ${answers.envFile} 未被 Git 忽略：如含敏感变量，建议自行将其加入 .gitignore（本命令不会代为修改）。`);
    }
  }
  return { files, warnings };
}
