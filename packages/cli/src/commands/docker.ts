import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { runAndStream, spawnStreaming } from '../utils/exec';
import { isDockerAvailable, resolveComposeCommand } from '../utils/docker';
import {
  resolveDockerContext,
  generateRootDockerfile,
  generateProdDockerCompose,
  generateDockerignore,
  generateMobileNginxConf,
  generateHostNginxExample,
  generateDockerEnvExample,
  ResolvedDockerContext,
} from '../utils/docker-gen';
import { findProjectRoot } from '../utils/project-root';
import { loadManifest } from '../config/loader';
import { SvtonProjectConfig } from '../config/types';

export interface DockerOptions {
  // init
  force?: boolean;
  template?: string;
  db?: string;
  mobile?: boolean;
  noHealthchecks?: boolean;
  // build
  service?: string;
  noCache?: boolean;
  buildArg?: string[];
  tag?: string;
  push?: boolean;
  platform?: string;
  // up
  profile?: string[];
  noBuild?: boolean;
  // down
  volumes?: boolean;
  rmi?: string;
  // logs
  tail?: number;
  // all
  file?: string;
}

const DOCKER_COMMANDS = ['init', 'build', 'up', 'down', 'logs'] as const;
type DockerCommand = (typeof DOCKER_COMMANDS)[number];
const DEFAULT_PROD_COMPOSE = 'docker-compose.prod.yml';

async function rootProjectName(root: string): Promise<string> {
  const pkgPath = path.join(root, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJSON(pkgPath);
      if (pkg?.name) return String(pkg.name).replace(/^@[^/]+\//, '');
    } catch {
      /* ignore */
    }
  }
  return path.basename(root);
}

/** 从根 packageManager 读 pnpm 版本,回退 8.12.0。 */
async function detectPnpmVersion(root: string): Promise<string> {
  const pkgPath = path.join(root, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJSON(pkgPath);
      const pm = pkg?.packageManager as string | undefined;
      if (pm && pm.startsWith('pnpm@')) return pm.slice('pnpm@'.length);
    } catch {
      /* ignore */
    }
  }
  return '8.12.0';
}

/** git 短 sha(非 git 仓返回 'latest')。 */
function gitShortSha(root: string): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'latest';
  }
}

/** 确保 next 应用的 next.config 含 output:'standalone'。 */
export async function ensureNextStandalone(root: string, dir: string): Promise<'present' | 'patched' | 'missing-config'> {
  for (const f of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
    const p = path.join(root, dir, f);
    if (!(await fs.pathExists(p))) continue;
    const txt = await fs.readFile(p, 'utf8');
    if (/output:\s*['"]standalone['"]/.test(txt)) return 'present';
    const patched = txt.replace(/(const\s+\w+\s*=\s*\{)|(module\.exports\s*=\s*\{)/, (m) => `${m}\n  output: 'standalone',`);
    if (patched !== txt) {
      await fs.writeFile(p, patched);
      return 'patched';
    }
    return 'missing-config';
  }
  return 'missing-config';
}

/** 把 CLI 选项覆盖进 manifest.docker(用于 init)。 */
function applyOptions(manifest: SvtonProjectConfig, options: DockerOptions): SvtonProjectConfig {
  const d = { ...(manifest.docker ?? {}) };
  if (options.db) {
    if (options.db === 'none') d.db = { ...d.db, enabled: false };
    else d.db = { ...d.db, engine: options.db as 'mysql' | 'postgres' };
  }
  if (options.mobile !== undefined) d.mobile = { ...d.mobile, enabled: options.mobile };
  if (options.template) d.rootDockerfile = options.template !== 'per-app';
  return { ...manifest, docker: d };
}

async function dockerInit(root: string, manifest: SvtonProjectConfig, options: DockerOptions): Promise<void> {
  const projectName = await rootProjectName(root);
  const pnpmVersion = await detectPnpmVersion(root);
  const resolved = applyOptions(manifest, options);
  const ctx = resolveDockerContext(resolved, projectName, pnpmVersion);
  const prodCompose = resolved.docker?.prodCompose ?? DEFAULT_PROD_COMPOSE;

  if (ctx.apps.length === 0) {
    logger.error('No containerizable apps found (need nest/next/node apps).');
    process.exit(1);
  }

  const writeIf = async (file: string, content: string, label: string) => {
    const abs = path.join(root, file);
    if ((await fs.pathExists(abs)) && !options.force) {
      logger.warn(`${file} exists — use --force to overwrite (skipped)`);
    } else {
      await fs.ensureDir(path.dirname(abs));
      await fs.writeFile(abs, content);
      logger.success(`wrote ${file} (${label})`);
    }
  };

  // 根 Dockerfile(多阶段)
  await writeIf('Dockerfile', generateRootDockerfile(ctx), 'root multi-stage');
  // 生产 compose
  await writeIf(prodCompose, generateProdDockerCompose(ctx), 'prod orchestration');
  // .dockerignore
  await writeIf('.dockerignore', generateDockerignore(), 'context ignore');
  // .env.example(docker 变量,缺失才补)
  const envPath = path.join(root, '.env.example');
  if (!(await fs.pathExists(envPath))) {
    await fs.writeFile(envPath, generateDockerEnvExample(ctx));
    logger.success('wrote .env.example (docker vars — copy to .env and fill)');
  }
  // mobile nginx.conf(有 taro app 就生成,无论 enabled —— 启用只改 flag)
  const mobileApp = Object.values(manifest.apps).find((a) => a.type === 'taro');
  if (mobileApp) {
    await writeIf(path.join(mobileApp.dir, 'nginx.conf'), generateMobileNginxConf(ctx.mobile?.port ?? 10086), 'mobile static');
    if (ctx.mobile?.enabled) logger.info('mobile service ENABLED (docker.mobile.enabled).');
    else logger.info('mobile nginx.conf generated; to containerize mobile set docker.mobile.enabled=true.');
  }
  // 宿主机 nginx 反代示例
  if (resolved.docker?.hostNginxExample !== false) {
    await writeIf(path.join('nginx', `${projectName}.conf.example`), generateHostNginxExample(ctx), 'host reverse-proxy');
  }
  // next standalone
  for (const app of ctx.apps) {
    if (app.type === 'next') {
      const r = await ensureNextStandalone(root, app.dir);
      if (r === 'patched') logger.success(`patched ${app.dir}/next.config → output: 'standalone'`);
      else if (r === 'missing-config') logger.warn(`${app.dir}: could not auto-add output:'standalone' — add manually`);
    }
  }

  logger.info('Next: `svton docker build` or `svton docker up` (copies .env.example → .env first).');
}

/** `svton docker <command>` action。 */
export async function docker(command: string, options: DockerOptions = {}): Promise<void> {
  if (!DOCKER_COMMANDS.includes(command as DockerCommand)) {
    logger.error(`Unknown docker command: ${command}`);
    logger.info(`Available: ${DOCKER_COMMANDS.join(', ')}`);
    process.exit(1);
  }

  const root = await findProjectRoot();
  const manifest = await loadManifest(root);
  const composeFile = options.file ?? manifest.docker?.prodCompose ?? DEFAULT_PROD_COMPOSE;
  const composeAbs = path.join(root, composeFile);

  if (command === 'init') {
    await dockerInit(root, manifest, options);
    return;
  }

  if (!isDockerAvailable()) {
    logger.error('Docker not found. Install Docker, then re-run.');
    process.exit(1);
  }
  const composeCmd = resolveComposeCommand();
  if (!composeCmd) {
    logger.error('Neither `docker compose` nor `docker-compose` is available.');
    process.exit(1);
  }
  if (!(await fs.pathExists(composeAbs))) {
    logger.error(`No ${composeFile} found. Run \`svton docker init\` first.`);
    process.exit(1);
  }

  const base = [...composeCmd.args, '-f', composeFile];
  const profiles = (options.profile ?? ['db']).flatMap((p) => ['--profile', p]);
  const svc = options.service ? [options.service] : [];

  switch (command as DockerCommand) {
    case 'build': {
      const args = [...base, 'build'];
      if (options.noCache) args.push('--no-cache');
      for (const a of options.buildArg ?? []) args.push('--build-arg', a);
      args.push(...svc);
      await runAndStream(composeCmd.bin, args, { cwd: root });
      if (options.push) await dockerPush(root, manifest, options);
      break;
    }
    case 'up': {
      const args = [...base, ...profiles, 'up', '-d'];
      if (!options.noBuild) args.push('--build');
      args.push(...svc);
      await runAndStream(composeCmd.bin, args, { cwd: root });
      break;
    }
    case 'down': {
      const args = [...base, ...profiles, 'down'];
      if (options.volumes) args.push('-v');
      if (options.rmi) args.push('--rmi', options.rmi);
      await runAndStream(composeCmd.bin, args, { cwd: root });
      break;
    }
    case 'logs': {
      const args = [...base, 'logs', '-f'];
      if (options.tail) args.push('--tail', String(options.tail));
      args.push(...svc);
      await spawnStreaming(composeCmd.bin, args, { cwd: root });
      break;
    }
  }
}

/** build 后推送镜像(需 image.registry)。 */
async function dockerPush(root: string, manifest: SvtonProjectConfig, options: DockerOptions): Promise<void> {
  const registry = manifest.docker?.image?.registry;
  if (!registry) {
    logger.error('--push requires docker.image.registry in svton.config.ts (e.g. ghcr.io/myorg). Skipping push.');
    return;
  }
  const projectName = await rootProjectName(root);
  const ctx = resolveDockerContext(manifest, projectName, await detectPnpmVersion(root));
  const tag = options.tag ?? (manifest.docker?.image?.tagPolicy === 'version' ? await readPkgVersion(root) : gitShortSha(root));
  for (const app of ctx.apps) {
    const local = `${projectName}-${app.name}:prod`;
    const remote = `${registry}/${projectName}-${app.name}:${tag}`;
    logger.info(`pushing ${remote} …`);
    await runAndStream('docker', ['tag', local, remote], { cwd: root });
    await runAndStream('docker', ['push', remote], { cwd: root });
  }
}

async function readPkgVersion(root: string): Promise<string> {
  try {
    const pkg = await fs.readJSON(path.join(root, 'package.json'));
    return pkg?.version ?? 'latest';
  } catch {
    return 'latest';
  }
}
