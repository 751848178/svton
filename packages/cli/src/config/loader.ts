import fs from 'fs-extra';
import path from 'path';
import createJITI from 'jiti';
import { SVTON_SCHEMA_VERSION, SvtonProjectConfig } from './types';
import { detectProject } from './detect';
import { findProjectRoot } from '../utils/project-root';

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

/**
 * 解析并返回当前项目的完整清单。
 *
 * 解析顺序：
 *  1. `findProjectRoot()` 定位根
 *  2. 若存在 `svton.config.{ts,js,mjs,cjs}` → 加载并校验（有 apps 时权威，否则与探测结果合并）
 *  3. 否则 `detectProject()`（marker-only 或完全无配置的 day-0 路径）
 */
export async function loadManifest(from?: string): Promise<SvtonProjectConfig> {
  const root = await findProjectRoot(from);
  const configPath = await locateConfig(root);

  if (configPath) {
    const config = await loadConfigFile(configPath, root);
    if (config.apps && Object.keys(config.apps).length > 0) {
      return config;
    }
    // 配置文件存在但未声明 apps → 用探测结果填充，保留用户显式字段
    const detected = await detectProject(root);
    return { ...detected, ...config, apps: { ...detected.apps, ...(config.apps ?? {}) } };
  }

  return detectProject(root);
}
