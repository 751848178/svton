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
  build?: boolean; // restart --build:重建并重建容器
  // down
  volumes?: boolean;
  rmi?: string;
  // logs
  tail?: number;
  // all
  file?: string;
  serial?: boolean;
}

const DOCKER_COMMANDS = ['init', 'build', 'up', 'restart', 'down', 'logs', 'check'] as const;
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

  if (command === 'check') {
    // 独立预检(不需要 Docker/compose)
    await preflightDocker(root, manifest);
    logger.success('Docker preflight: OK');
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

  // up/build/restart 前做全面预检(env / 镜像源 / lockfile / 迁移 / 健康端点 / 内存)
  if (command === 'up' || command === 'build' || command === 'restart') {
    await preflightDocker(root, manifest);
  }

  const base = [...composeCmd.args, '-f', composeFile];
  // 默认 profile 从项目配置读(与 init 生成时用的 db.profile 一致),--profile flag 可覆盖/追加
  const defaultProfile = manifest.docker?.db?.profile ?? 'db';
  const profiles = (options.profile ?? [defaultProfile]).flatMap((p) => ['--profile', p]);
  const svc = options.service ? [options.service] : [];
  // 串行构建:flag 优先 → config.docker.serial → 内存不足时自动串行(防 OOM)
  const lowMem = await detectLowMemory();
  const serial = options.serial ?? manifest.docker?.serial ?? lowMem;
  if (lowMem && serial && !manifest.docker?.serial) {
    logger.warn(`内存较低 → 自动启用串行构建(--no-serial 可覆盖;或 config 设 docker.serial:true 固化)`);
  }

  // 构建并 up -d(up 与 restart --build 共用)。串行则逐个 build 再 up;否则 up --build 一步。
  const bringUp = async () => {
    if (serial && !options.noBuild) {
      const targets = svc.length ? svc : await serviceNames(manifest, root);
      for (const s of targets) {
        logger.info(`[serial] building ${s} …`);
        const bargs = [...base, 'build'];
        if (options.noCache) bargs.push('--no-cache');
        bargs.push(s);
        await runAndStream(composeCmd.bin, bargs, { cwd: root });
      }
      await runAndStream(composeCmd.bin, [...base, ...profiles, 'up', '-d', '--force-recreate', ...svc], { cwd: root });
    } else {
      const args = [...base, ...profiles, 'up', '-d'];
      if (!options.noBuild) args.push('--build');
      args.push(...svc);
      await runAndStream(composeCmd.bin, args, { cwd: root });
    }
  };

  switch (command as DockerCommand) {
    case 'build': {
      if (serial) {
        const targets = svc.length ? svc : await serviceNames(manifest, root);
        for (const s of targets) {
          logger.info(`[serial] building ${s} …`);
          const args = [...base, 'build'];
          if (options.noCache) args.push('--no-cache');
          for (const a of options.buildArg ?? []) args.push('--build-arg', a);
          args.push(s);
          await runAndStream(composeCmd.bin, args, { cwd: root });
        }
      } else {
        const args = [...base, 'build'];
        if (options.noCache) args.push('--no-cache');
        for (const a of options.buildArg ?? []) args.push('--build-arg', a);
        args.push(...svc);
        await runAndStream(composeCmd.bin, args, { cwd: root });
      }
      if (options.push) await dockerPush(root, manifest, options);
      break;
    }
    case 'up': {
      await bringUp();
      break;
    }
    case 'restart': {
      // 默认快速重启(不重建,= docker compose restart);--build 则重建并重建容器(走 bringUp)
      if (options.build) {
        await bringUp();
      } else {
        await runAndStream(composeCmd.bin, [...base, ...profiles, 'restart', ...svc], { cwd: root });
      }
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

/** 检测可用内存是否偏低(触发自动串行构建,防 OOM)。 */
async function detectLowMemory(): Promise<boolean> {
  try {
    const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
    const memMB = parseInt((meminfo.match(/^MemAvailable:\s+(\d+)/m) || [])[1] || '99999') / 1024;
    const swapMB = parseInt((meminfo.match(/^SwapTotal:\s+(\d+)/m) || [])[1] || '0') / 1024;
    return memMB < 3072 && swapMB < 2048; // <3GB RAM + <2GB swap → 低内存
  } catch {
    return false; // 非 Linux(macOS)不触发
  }
}

/** 可构建的 compose 服务名(apps + mobile-if-enabled),用于串行构建。 */
async function serviceNames(manifest: SvtonProjectConfig, root: string): Promise<string[]> {
  const projectName = await rootProjectName(root);
  const pnpmVersion = await detectPnpmVersion(root);
  const ctx = resolveDockerContext(manifest, projectName, pnpmVersion);
  const names = ctx.apps.map((a) => a.name);
  if (ctx.mobile?.enabled) names.push('mobile');
  return names;
}

/** 起飞前全面检查:env / .npmrc 镜像源 / lockfile / 迁移文件 / 健康端点 / DATABASE_URL / 内存。
 *  errors = 阻断(exit);warnings = 提示(交互式问 y/N 或直接放行)。 */
interface PreflightItem {
  level: 'error' | 'warn';
  message: string;
  fix: string;
}

async function preflightDocker(root: string, manifest: SvtonProjectConfig): Promise<void> {
  const items: PreflightItem[] = [];

  // .env
  const envPath = path.join(root, '.env');
  const envExists = await fs.pathExists(envPath);
  if (!envExists) {
    items.push({ level: 'error', message: '.env not found — compose ${VAR} 插值会空', fix: 'cp .env.example .env 然后填真实密码' });
  } else {
    const env = await fs.readFile(envPath, 'utf8');
    for (const k of ['MYSQL_ROOT_PASSWORD', 'DATABASE_URL', 'JWT_SECRET']) {
      if (!new RegExp(`^${k}=`, 'm').test(env)) items.push({ level: 'error', message: `.env 缺少 ${k}`, fix: '编辑 .env 添加该变量(参考 .env.example)' });
      else if (new RegExp(`^${k}=['"]?\\s*(#.*)?$`, 'm').test(env)) items.push({ level: 'error', message: `.env 中 ${k} 值为空`, fix: '编辑 .env 填入真实值' });
    }
    // DATABASE_URL 用了 localhost
    const dbUrl = (env.match(/^DATABASE_URL=(.+)$/m) || [])[1] || '';
    const host = (dbUrl.split('@')[1] || '').split('/')[0] || '';
    if (/localhost|127\.0\.0\.1/.test(host)) {
      items.push({ level: 'warn', message: `DATABASE_URL 主机是 ${host} —— 容器内连不到 localhost`, fix: '改为 compose 服务名,如 mysql:3306' });
    }
  }

  // .npmrc 镜像源(中国服务器走 npmjs.org 很慢)
  const npmrcPath = path.join(root, '.npmrc');
  if (!(await fs.pathExists(npmrcPath))) {
    items.push({ level: 'warn', message: '无 .npmrc —— Docker build 从 npmjs.org 下载(中国服务器极慢)', fix: '创建 .npmrc 加 registry=https://registry.npmmirror.com' });
  } else {
    const npmrc = await fs.readFile(npmrcPath, 'utf8');
    if (!/registry\s*=/.test(npmrc)) {
      items.push({ level: 'warn', message: '.npmrc 未指定 registry —— Docker build 从 npmjs.org 下载(慢)', fix: '.npmrc 加 registry=https://registry.npmmirror.com' });
    }
  }

  // pnpm-lock.yaml(--frozen-lockfile 必需)
  if (!(await fs.pathExists(path.join(root, 'pnpm-lock.yaml')))) {
    items.push({ level: 'error', message: 'pnpm-lock.yaml 不存在 —— --frozen-lockfile 会失败', fix: '运行 pnpm install 生成 lockfile 并提交' });
  }

  // prisma migrations(有 backend 但无迁移文件 → migrate deploy 无迁移可应用)
  const dbDir = manifest.database?.dir;
  if (dbDir && !(await fs.pathExists(path.join(root, dbDir, 'prisma', 'migrations')))) {
    items.push({ level: 'warn', message: `${dbDir}/prisma/migrations/ 不存在 —— migrate deploy 无迁移可跑`, fix: 'svton db migrate --name init 生成初始迁移' });
  }

  // backend 健康端点
  const backend = Object.values(manifest.apps).find((a) => a.type === 'nest');
  if (backend && !backend.ready?.http) {
    items.push({ level: 'warn', message: 'backend 无 ready.http 健康探针 —— compose healthcheck 可能不过', fix: 'svton.config.ts 里 backend 加 ready:{http:"..."}' });
  }

  // 内存/swap(小 VM build 会 OOM)
  try {
    const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
    const memMB = parseInt((meminfo.match(/^MemAvailable:\s+(\d+)/m) || [])[1] || '0') / 1024;
    const swapMB = parseInt((meminfo.match(/^SwapTotal:\s+(\d+)/m) || [])[1] || '0') / 1024;
    if (memMB < 1024 && swapMB < 1024) {
      items.push({ level: 'warn', message: `可用内存低(${Math.round(memMB)}MB RAM + ${Math.round(swapMB)}MB swap) —— Docker build 可能 OOM`, fix: '加 swap:fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile;或 --serial 串行 build' });
    }
  } catch {
    /* 非 Linux */
  }

  if (items.length === 0) return; // 一切就绪

  // 输出
  const errors = items.filter((i) => i.level === 'error');
  const warnings = items.filter((i) => i.level === 'warn');
  if (errors.length) {
    logger.error(`\n✗ ${errors.length} 个错误(必须修复):`);
    errors.forEach((e) => logger.error(`  ✗ ${e.message}\n     → ${e.fix}`));
  }
  if (warnings.length) {
    logger.warn(`\n! ${warnings.length} 个警告(建议修复):`);
    warnings.forEach((w) => logger.warn(`  ! ${w.message}\n     → ${w.fix}`));
  }

  // errors → 阻断;warnings → 只打印提示,直接继续(不拦)
  if (errors.length) {
    process.exit(1);
  }
}
