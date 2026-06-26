import fs from 'fs-extra';
import path from 'path';
import createJITI from 'jiti';
import { SVTON_SCHEMA_VERSION, SvtonProjectConfig } from './types';
import { detectProject, detectPackageManager } from './detect';
import { findProjectRoot } from '../utils/project-root';
import { spawnStreaming } from '../utils/exec';
import { logger } from '../utils/logger';

const CONFIG_FILES = ['svton.config.ts', 'svton.config.js', 'svton.config.mjs', 'svton.config.cjs'];

/** 在项目根查找 svton.config.* 文件，返回绝对路径或 null。 */
export async function locateConfig(root: string): Promise<string | null> {
  for (const file of CONFIG_FILES) {
    const abs = path.join(root, file);
    if (await fs.pathExists(abs)) return abs;
  }
  return null;
}

function assertSchema(config: unknown): asserts config is SvtonProjectConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('svton.config: expected an object (did you forget `export default defineSvtonProject({...})`?)');
  }
  const schema = (config as SvtonProjectConfig).schema;
  if (schema !== SVTON_SCHEMA_VERSION) {
    throw new Error(
      `svton.config: schema is ${schema}, expected ${SVTON_SCHEMA_VERSION}. ` +
        `Upgrade @svton/cli or update the manifest.`,
    );
  }
}

/** 加载某个配置文件（.ts/.js/.mjs/.cjs 统一走 jiti，规避 CJS/ESM require 差异）。 */
async function loadConfigFile(absPath: string, root: string): Promise<SvtonProjectConfig> {
  const jiti = createJITI(root);
  const mod = (await jiti.import(absPath, {})) as { default?: SvtonProjectConfig } & SvtonProjectConfig;
  const config = mod?.default ?? mod;
  assertSchema(config);
  return config;
}

/** 加载 config 并与探测结果合并(配置声明 apps 时权威,否则用探测填充)。 */
async function tryLoad(configPath: string, root: string): Promise<SvtonProjectConfig> {
  const config = await loadConfigFile(configPath, root);
  if (config.apps && Object.keys(config.apps).length > 0) return config;
  const detected = await detectProject(root);
  return { ...detected, ...config, apps: { ...detected.apps, ...(config.apps ?? {}) } };
}

/** 错误是否为「config 里 import 了 @svton/cli 但解析不到」。 */
export function isMissingCliError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Cannot find module '@svton\/cli'|Cannot resolve '@svton\/cli'|Failed to resolve '@svton\/cli'/.test(msg);
}

/** @svton/cli 是否已在根 package.json 的依赖中声明。 */
export async function cliDeclared(root: string): Promise<boolean> {
  const pkgPath = path.join(root, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return false;
  try {
    const pkg = await fs.readJSON(pkgPath);
    return Boolean(
      (pkg.dependencies && '@svton/cli' in pkg.dependencies) ||
        (pkg.devDependencies && '@svton/cli' in pkg.devDependencies),
    );
  } catch {
    return false;
  }
}

/**
 * 解析并返回当前项目的完整清单。
 *
 * 解析顺序：
 *  1. `findProjectRoot()` 定位根
 *  2. 若存在 `svton.config.{ts,js,mjs,cjs}` → 加载并校验
 *  3. 否则 `detectProject()`（marker-only 或完全无配置的 day-0 路径）
 *
 * 若 config 里 `import '@svton/cli'` 但项目未安装、且已声明为依赖 ——
 * 用**项目的包管理器**自动 `install` 后重试(而非别名/吞错)。
 * 其它加载失败一律抛出明确错误,不静默回退。
 */
export async function loadManifest(from?: string): Promise<SvtonProjectConfig> {
  const root = await findProjectRoot(from);
  const configPath = await locateConfig(root);
  if (!configPath) return detectProject(root);

  try {
    return await tryLoad(configPath, root);
  } catch (err) {
    if (isMissingCliError(err) && (await cliDeclared(root))) {
      const pm = await detectPackageManager(root);
      logger.info(`svton.config.ts imports "@svton/cli" but it isn't installed — running \`${pm} install\` …`);
      await spawnStreaming(pm, ['install'], { cwd: root });
      return await tryLoad(configPath, root); // 装完重试;再失败则抛出
    }
    const rel = path.relative(root, configPath);
    const msg = err instanceof Error ? err.message : String(err);
    const hint = isMissingCliError(err)
      ? ' Run `<pm> add -D @svton/cli` to add it as a dependency, or remove the import from svton.config.ts.'
      : '';
    throw new Error(`Could not load ${rel}: ${msg}.${hint}`);
  }
}
