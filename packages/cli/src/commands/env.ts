import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { findProjectRoot } from '../utils/project-root';
import { loadManifest } from '../config/loader';
import { SvtonProjectConfig } from '../config/types';

const ENV_KEY_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

/** 从 env 文本里解析出已定义的 key 集合（忽略注释与空行）。 */
export function parseEnvKeys(text: string): Set<string> {
  const keys = new Set<string>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(ENV_KEY_RE);
    if (m) keys.add(m[1]);
  }
  return keys;
}

/** 返回 example 中存在但 actual 中缺失的 key。 */
export function diffEnv(exampleText: string, actualText: string): string[] {
  const expected = parseEnvKeys(exampleText);
  const actual = parseEnvKeys(actualText);
  return [...expected].filter((k) => !actual.has(k));
}

export interface EnvPair {
  dir: string;
  examplePath: string;
  envPath: string | null;
}

/** 收集需要做 env 检查的目录（根 + 每个 app，凡含 `.env.example` 的）。 */
export async function findEnvPairs(root: string, manifest: SvtonProjectConfig): Promise<EnvPair[]> {
  const exampleName = manifest.env?.example ?? '.env.example';
  const envFiles = manifest.env?.files ?? ['.env', '.env.local'];
  const dirs = ['.', ...Object.values(manifest.apps).map((a) => a.dir)];

  const pairs: EnvPair[] = [];
  for (const dir of dirs) {
    const examplePath = path.join(root, dir, exampleName);
    if (!(await fs.pathExists(examplePath))) continue;
    let envPath: string | null = null;
    for (const f of envFiles) {
      const p = path.join(root, dir, f);
      if (await fs.pathExists(p)) {
        envPath = p;
        break;
      }
    }
    pairs.push({ dir: dir === '.' ? '<root>' : dir, examplePath, envPath });
  }
  return pairs;
}

export interface EnvIssue {
  dir: string;
  envExists: boolean;
  missing: string[];
}

/** 收集所有 env 问题（doctor 与 env check 共用）。 */
export async function collectEnvIssues(root: string, manifest: SvtonProjectConfig): Promise<EnvIssue[]> {
  const pairs = await findEnvPairs(root, manifest);
  const issues: EnvIssue[] = [];
  for (const pair of pairs) {
    if (!pair.envPath) {
      issues.push({ dir: pair.dir, envExists: false, missing: [] });
      continue;
    }
    const [exampleText, envText] = await Promise.all([
      fs.readFile(pair.examplePath, 'utf8'),
      fs.readFile(pair.envPath, 'utf8'),
    ]);
    issues.push({ dir: pair.dir, envExists: true, missing: diffEnv(exampleText, envText) });
  }
  return issues;
}

export interface EnvOptions {
  fix?: boolean;
}

/** `svton env check [app]` action。 */
export async function envCheck(target: string | undefined, options: EnvOptions = {}): Promise<void> {
  const root = await findProjectRoot();
  const manifest = await loadManifest(root);

  let scoped = manifest;
  if (target) {
    const app = manifest.apps[target];
    if (!app) {
      logger.error(`Unknown app: ${target}`);
      process.exit(1);
    }
    scoped = { ...manifest, apps: { [target]: app } };
  }

  const issues = await collectEnvIssues(root, scoped);

  if (issues.length === 0) {
    logger.success('No .env.example files found — nothing to check.');
    return;
  }

  let hasProblems = false;
  for (const issue of issues) {
    if (!issue.envExists) {
      hasProblems = true;
      logger.warn(`${chalk.bold(issue.dir)}: .env missing (only .env.example present)`);
      if (options.fix) {
        // fix：拷贝 .env.example → .env
        const examplePath = path.join(root, issue.dir === '<root>' ? '.' : issue.dir, scoped.env?.example ?? '.env.example');
        const envPath = path.join(root, issue.dir === '<root>' ? '.' : issue.dir, '.env');
        await fs.copy(examplePath, envPath);
        logger.success(`  → created ${path.relative(root, envPath)} from example`);
      }
      continue;
    }
    if (issue.missing.length === 0) {
      logger.success(`${chalk.bold(issue.dir)}: env up to date`);
    } else {
      hasProblems = true;
      logger.warn(`${chalk.bold(issue.dir)}: missing ${issue.missing.length} key(s): ${issue.missing.join(', ')}`);
    }
  }

  if (hasProblems && !options.fix) {
    process.exitCode = 1;
  }
}
