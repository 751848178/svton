import fs from 'fs-extra';
import path from 'path';
import { AppType, SvtonAppConfig, SvtonProjectConfig, SVTON_SCHEMA_VERSION } from './types';
import { PackageManager } from '../utils/exec';

interface MinimalPkg {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** 解析 pnpm-workspace.yaml 里的 package glob 列表（手写正则，不引 yaml 依赖）。 */
export async function readWorkspaceGlobs(root: string): Promise<string[]> {
  const file = path.join(root, 'pnpm-workspace.yaml');
  if (!(await fs.pathExists(file))) return [];
  const text = await fs.readFile(file, 'utf8');
  const globs: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s+['"]?([^'"\s]+)['"]?\s*$/);
    if (m && m[1]) globs.push(m[1]);
  }
  return globs;
}

/** 读取 `apps/` 下所有含 package.json 的子目录（相对根的路径）。 */
async function readAppDirs(root: string): Promise<string[]> {
  const appsDir = path.join(root, 'apps');
  if (!(await fs.pathExists(appsDir))) return [];
  const entries = await fs.readdir(appsDir);
  const apps: string[] = [];
  for (const entry of entries) {
    const abs = path.join(appsDir, entry);
    if ((await fs.stat(abs)).isDirectory() && (await fs.pathExists(path.join(abs, 'package.json')))) {
      apps.push(path.join('apps', entry));
    }
  }
  return apps;
}

async function readPkg(root: string, rel: string): Promise<MinimalPkg | null> {
  const pkgPath = path.join(root, rel, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return null;
  try {
    return await fs.readJSON(pkgPath);
  } catch {
    return null;
  }
}

/** 应用名作为 manifest key：去掉 scope 前缀，如 `@svton/devpilot-api` → `devpilot-api`。 */
function appName(pkg: MinimalPkg, fallback: string): string {
  const name = pkg.name ?? fallback;
  return name.includes('/') ? name.split('/').pop()! : name;
}

/** 依赖里是否包含某个包（合并 dependencies + devDependencies）。 */
function hasDep(pkg: MinimalPkg, name: string): boolean {
  return Boolean((pkg.dependencies && name in pkg.dependencies) || (pkg.devDependencies && name in pkg.devDependencies));
}

/** 推断应用类型。 */
export function inferAppType(pkg: MinimalPkg): AppType {
  if (hasDep(pkg, '@nestjs/core') || hasDep(pkg, '@nestjs/common')) return 'nest';
  if (hasDep(pkg, 'next')) return 'next';
  if (hasDep(pkg, '@tarojs/taro') || hasDep(pkg, '@tarojs/cli')) return 'taro';
  return 'node';
}

/** 从 `next dev -p 3100` 这类脚本里提取端口。 */
export function inferPortFromScript(script: string | undefined): number | undefined {
  if (!script) return undefined;
  const m = script.match(/-p\s+(\d+)/);
  return m ? Number(m[1]) : undefined;
}

interface NestMainInfo {
  port?: number;
  prefix?: string;
}

/** 读 nest 应用的 src/main.ts，解析默认端口与全局前缀。 */
async function readNestMain(root: string, appDir: string): Promise<NestMainInfo> {
  const mainPath = path.join(root, appDir, 'src', 'main.ts');
  if (!(await fs.pathExists(mainPath))) return {};
  const text = await fs.readFile(mainPath, 'utf8');
  const info: NestMainInfo = {};
  const portMatch = text.match(/process\.env\.PORT\s*\|\|\s*(\d+)/);
  if (portMatch) info.port = Number(portMatch[1]);
  const prefixMatch = text.match(/setGlobalPrefix\(\s*['"]([^'"]+)['"]\s*\)/);
  if (prefixMatch) info.prefix = prefixMatch[1];
  return info;
}

function joinUrl(port: number, prefix?: string): string {
  const base = `http://localhost:${port}`;
  return prefix ? `${base}/${prefix.replace(/^\/+|\/+$/g, '')}` : base;
}

/** 为单个 app 构建配置（纯推断）。 */
async function buildAppConfig(root: string, appDir: string): Promise<[string, SvtonAppConfig] | null> {
  const pkg = await readPkg(root, appDir);
  if (!pkg) return null;
  const name = appName(pkg, path.basename(appDir));
  const type = inferAppType(pkg);
  const scripts = pkg.scripts ?? {};
  const config: SvtonAppConfig = { dir: appDir, type };

  if (type === 'next') {
    const port = inferPortFromScript(scripts.dev);
    if (port) {
      config.port = port;
      config.baseURL = joinUrl(port);
    }
  } else if (type === 'nest') {
    const main = await readNestMain(root, appDir);
    if (main.port) {
      config.port = main.port;
      config.baseURL = joinUrl(main.port, main.prefix);
    }
    const hasHealth = await fs.pathExists(path.join(root, appDir, 'src', 'health.controller.ts'));
    if (config.baseURL && hasHealth) {
      config.ready = { http: `${config.baseURL}/health` };
    }
  }

  return [name, config];
}

/** 扫描 apps，找到含 `prisma/schema.prisma` 的目录。 */
async function detectDatabaseDir(root: string, appDirs: string[]): Promise<string | null> {
  const matches: string[] = [];
  for (const dir of appDirs) {
    if (await fs.pathExists(path.join(root, dir, 'prisma', 'schema.prisma'))) {
      matches.push(dir);
    }
  }
  if (matches.length === 1) return matches[0];
  return null; // 0 个或多个（多个需用户在 manifest 显式指定）
}

/** 从根 package.json.packageManager 探测包管理器。 */
export async function detectPackageManager(root: string): Promise<PackageManager> {
  const pkgPath = path.join(root, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJSON(pkgPath);
      const pm = pkg?.packageManager as string | undefined;
      if (pm && typeof pm === 'string') {
        if (pm.startsWith('pnpm')) return 'pnpm';
        if (pm.startsWith('yarn')) return 'yarn';
        if (pm.startsWith('npm')) return 'npm';
      }
    } catch {
      /* ignore */
    }
  }
  if (await fs.pathExists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fs.pathExists(path.join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/**
 * 无 manifest 时，自动推断一份默认清单，使项目 day-0 可用。
 */
export async function detectProject(root: string): Promise<SvtonProjectConfig> {
  const appDirs = await readAppDirs(root);
  const apps: Record<string, SvtonAppConfig> = {};
  for (const dir of appDirs) {
    const entry = await buildAppConfig(root, dir);
    if (entry) apps[entry[0]] = entry[1];
  }
  const databaseDir = await detectDatabaseDir(root, appDirs);
  const pm = await detectPackageManager(root);

  return {
    schema: SVTON_SCHEMA_VERSION,
    pm,
    apps,
    ...(databaseDir ? { database: { orm: 'prisma', dir: databaseDir } } : {}),
    env: { files: ['.env', '.env.local'], example: '.env.example' },
    services: { compose: 'docker-compose.yml' },
  };
}
