import { basename, dirname } from 'path';
import { detectEnvironmentVariables } from './repository-environment-detector.utils';
import {
  DetectedCommandSet,
  DetectedService,
  RepositoryInventory,
} from './repository-parser.types';

type PackageJson = {
  name?: string;
  private?: boolean;
  version?: string;
  packageManager?: string;
  workspaces?: string[] | { packages?: string[] };
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
export function detectPackageServices(inventory: RepositoryInventory): DetectedService[] {
  const packages = Object.entries(inventory.manifests)
    .filter(([file]) => file === 'package.json' || file.endsWith('/package.json'))
    .map(([file, content]) => ({ file, value: parsePackage(content) }))
    .filter((item): item is { file: string; value: PackageJson } => Boolean(item.value));
  const root = packages.find((item) => item.file === 'package.json')?.value;
  const hasWorkspaceFile = Boolean(inventory.manifests['pnpm-workspace.yaml']);
  return packages
    .filter((item) => !(item.file === 'package.json'
      && packages.length > 1
      && isWorkspaceRoot(root, hasWorkspaceFile)))
    .map((item) => buildService(inventory, item.file, item.value));
}
export function detectRepositoryPackageFacts(inventory: RepositoryInventory) {
  const root = parsePackage(inventory.manifests['package.json'] || '');
  const packageManager = root?.packageManager?.split('@')[0]
    || (inventory.files.includes('pnpm-lock.yaml') ? 'pnpm'
      : inventory.files.includes('yarn.lock') ? 'yarn'
        : inventory.files.includes('package-lock.json') ? 'npm' : undefined);
  const packageManagerVersion = root?.packageManager?.split('@').slice(1).join('@') || undefined;
  const workspacePatterns = Array.isArray(root?.workspaces)
    ? root.workspaces
    : root?.workspaces?.packages || parsePnpmWorkspace(inventory.manifests['pnpm-workspace.yaml']);
  return {
    monorepo: workspacePatterns.length > 0,
    packageManager,
    packageManagerVersion,
    workspacePatterns,
    lockfiles: inventory.files.filter((file) => /(?:pnpm-lock\.yaml|yarn\.lock|package-lock\.json|bun\.lockb?)$/.test(file)),
  };
}
function buildService(
  inventory: RepositoryInventory,
  packageFile: string,
  pkg: PackageJson,
): DetectedService {
  const path = dirname(packageFile) === '.' ? '.' : dirname(packageFile);
  const scripts = pkg.scripts || {};
  const dependencies = { ...pkg.devDependencies, ...pkg.dependencies };
  const dockerfile = inventory.files.find((file) => file === `${path}/Dockerfile`
    || (path === '.' && file === 'Dockerfile'));
  const role = detectRole(path, pkg.name);
  const deployable = Boolean(scripts.start || dockerfile);
  const shared = path.startsWith('packages/');
  const commands = detectCommands(scripts);
  return {
    key: slug(path === '.' ? pkg.name || 'root' : path),
    name: pkg.name || basename(path),
    path,
    role,
    deployable,
    artifactOnly: !deployable && !shared && Object.keys(scripts).some((key) => key.startsWith('build')),
    framework: detectFrameworks(dependencies),
    runtime: pkg.engines?.node ? `node ${pkg.engines.node}` : 'node',
    versions: pickVersions(dependencies),
    commands,
    ports: detectPorts(inventory, path, scripts, dockerfile),
    healthChecks: [],
    environment: detectEnvironmentVariables(inventory, path),
    databases: detectDatabases(dependencies, inventory, path),
    dependencies: [],
    container: {
      dockerfile,
      buildContext: dockerfile && dockerfile !== 'Dockerfile' ? inferDockerContext(inventory, dockerfile) : '.',
      composeFiles: [],
      composeServices: [],
      dependsOn: [],
    },
    artifacts: detectArtifacts(path, dependencies, commands),
    evidence: [
      { file: packageFile, kind: 'package_manifest', detail: `package ${pkg.name || path}`, confidence: 'high' },
      ...(dockerfile ? [{ file: dockerfile, kind: 'dockerfile', detail: '检测到 Dockerfile', confidence: 'high' as const }] : []),
    ],
    warnings: deployable ? [] : ['未检测到通用服务启动入口，需要确认是否仅产出构建制品。'],
  };
}

function detectCommands(scripts: Record<string, string>): DetectedCommandSet {
  const find = (pattern: RegExp) => Object.entries(scripts).find(([key]) => pattern.test(key))?.[1];
  return {
    build: scripts.build,
    start: scripts.start || scripts['start:prod'],
    test: scripts.test,
    migrate: find(/migrat.*deploy|deploy.*migrat|^migrate$/i),
    bootstrap: find(/bootstrap|initialize|init:prod/i),
    seed: find(/^seed|db:seed/i),
    backfill: find(/backfill/i),
  };
}

function detectFrameworks(deps: Record<string, string>): string[] {
  const mapping: Array<[string, string]> = [
    ['@nestjs/core', 'NestJS'], ['next', 'Next.js'], ['react', 'React'],
    ['@tarojs/taro', 'Taro'], ['vue', 'Vue'], ['nuxt', 'Nuxt'],
    ['express', 'Express'], ['@prisma/client', 'Prisma'],
  ];
  return mapping.filter(([key]) => deps[key]).map(([, label]) => label);
}

function pickVersions(deps: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    ['@nestjs/core', 'next', 'react', '@tarojs/taro', 'vue', 'nuxt', '@prisma/client']
      .filter((key) => deps[key])
      .map((key) => [key, deps[key]]),
  );
}

function detectRole(path: string, name?: string): string {
  const value = `${path}/${name || ''}`.toLowerCase();
  if (/backend|server|api/.test(value)) return 'backend';
  if (/admin|dashboard|console/.test(value)) return 'admin';
  if (/mobile|taro|mini/.test(value)) return 'mobile';
  if (path.startsWith('packages/')) return 'shared';
  return 'service';
}

function detectPorts(
  inventory: RepositoryInventory,
  scope: string,
  scripts: Record<string, string>,
  dockerfile?: string,
): number[] {
  const values = new Set<number>();
  const text = `${Object.values(scripts).join('\n')}\n${dockerfile ? inventory.manifests[dockerfile] || '' : ''}`;
  for (const match of text.matchAll(/(?:EXPOSE\s+|-p\s+|PORT\s*[=:]\s*)(\d{2,5})/gi)) {
    values.add(Number(match[1]));
  }
  for (const [file, content] of Object.entries(inventory.manifests)) {
    if (scope !== '.' && !file.startsWith(`${scope}/`)) continue;
    for (const match of content.matchAll(/(?:\|\||\?\?)\s*(\d{4,5})/g)) values.add(Number(match[1]));
  }
  return [...values].filter((port) => port > 0 && port < 65_536).sort((a, b) => a - b);
}

function detectDatabases(
  deps: Record<string, string>,
  inventory: RepositoryInventory,
  scope: string,
): string[] {
  const values = new Set<string>();
  if (deps.mysql2) values.add('mysql');
  if (deps.pg || deps.postgres) values.add('postgresql');
  if (deps.ioredis || deps.redis) values.add('redis');
  const prisma = Object.entries(inventory.manifests)
    .find(([file]) => file.startsWith(scope === '.' ? '' : `${scope}/`) && file.endsWith('schema.prisma'))?.[1];
  const provider = prisma
    ?.match(/datasource\s+\w+\s*\{[^}]*\bprovider\s*=\s*["']([^"']+)["']/s)?.[1];
  if (provider) values.add(provider === 'postgresql' ? 'postgresql' : provider);
  return [...values];
}

function detectArtifacts(
  path: string,
  deps: Record<string, string>,
  commands: DetectedCommandSet,
): string[] {
  if (deps.next) return [`${path}/.next/standalone`, `${path}/.next/static`];
  if (commands.build && deps['@nestjs/core']) return [`${path}/dist`];
  if (commands.build) return [`${path}/dist`];
  return [];
}

function inferDockerContext(inventory: RepositoryInventory, dockerfile: string): string {
  const content = inventory.manifests[dockerfile] || '';
  return /(?:COPY|ADD)\s+(?:package\.json|pnpm-lock\.yaml|packages\/)/.test(content) ? '.' : dirname(dockerfile);
}
function isWorkspaceRoot(pkg: PackageJson | undefined, hasWorkspaceFile: boolean): boolean {
  return Boolean(pkg?.private && (pkg.workspaces || hasWorkspaceFile));
}
function parsePackage(content: string): PackageJson | undefined {
  try { return JSON.parse(content) as PackageJson; } catch { return undefined; }
}

function parsePnpmWorkspace(content?: string): string[] {
  return content
    ? [...content.matchAll(/^\s*-\s*['"]?([^'"\n]+)['"]?\s*$/gm)].map((match) => match[1])
    : [];
}
function slug(value: string): string {
  return value.replace(/^apps\//, '').replace(/^packages\//, '').replace(/[^A-Za-z0-9_-]+/g, '-');
}
