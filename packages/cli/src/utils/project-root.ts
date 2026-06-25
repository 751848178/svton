import fs from 'fs-extra';
import path from 'path';

const CONFIG_FILES = ['svton.config.ts', 'svton.config.js', 'svton.config.mjs', 'svton.config.cjs'];

/** 当前目录不在任何 Svton 项目内时抛出。 */
export class NotASvtonProjectError extends Error {
  constructor(cwd: string) {
    super(
      `svton: not inside a Svton project (${cwd}).\n` +
        `  No svton.config.{ts,js}, "svton" marker in package.json, or apps/* workspace found.\n` +
        `  Run \`svton create <name>\` to scaffold one, or add a svton.config.ts at your project root.`,
    );
    this.name = 'NotASvtonProjectError';
  }
}

/** 某目录是否包含 svton.config.* 文件。 */
async function hasSvtonConfig(dir: string): Promise<string | null> {
  for (const file of CONFIG_FILES) {
    if (await fs.pathExists(path.join(dir, file))) return path.join(dir, file);
  }
  return null;
}

/** 某目录的 package.json 是否含 `"svton"` 字段。 */
async function hasSvtonMarker(dir: string): Promise<boolean> {
  const pkgPath = path.join(dir, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return false;
  try {
    const pkg = await fs.readJSON(pkgPath);
    return pkg && typeof pkg === 'object' && 'svton' in pkg;
  } catch {
    return false;
  }
}

/** 启发式：turbo.json + pnpm-workspace.yaml + apps/ 目录同时存在。 */
async function looksLikeMonorepo(dir: string): Promise<boolean> {
  const hasTurbo = await fs.pathExists(path.join(dir, 'turbo.json'));
  const hasWorkspace = await fs.pathExists(path.join(dir, 'pnpm-workspace.yaml'));
  const hasApps = await fs.pathExists(path.join(dir, 'apps'));
  return hasTurbo && hasWorkspace && hasApps;
}

/**
 * 从 `from`（默认 cwd）向上查找 Svton 项目根。
 *
 * 解析顺序（首个命中即返回）：
 *  1. 含 `svton.config.{ts,js,mjs,cjs}` 的最近祖先
 *  2. 含 `package.json` 且带 `"svton"` 字段的最近祖先
 *  3. 同时含 `turbo.json` + `pnpm-workspace.yaml` + `apps/` 的最近祖先（启发式）
 *
 * 都未命中时抛 `NotASvtonProjectError`。
 */
export async function findProjectRoot(from: string = process.cwd()): Promise<string> {
  let dir = path.resolve(from);
  // 先扫一遍专门找 config 文件 / marker / 启发式（向上直到根）
  while (true) {
    if (await hasSvtonConfig(dir)) return dir;
    if (await hasSvtonMarker(dir)) return dir;
    if (await looksLikeMonorepo(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break; // 到达文件系统根
    dir = parent;
  }
  throw new NotASvtonProjectError(from);
}

/** 是否在 Svton 项目内（不抛错）。 */
export async function isSvtonProject(dir: string = process.cwd()): Promise<boolean> {
  try {
    await findProjectRoot(dir);
    return true;
  } catch {
    return false;
  }
}
