import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { runAndStream, spawnStreaming } from '../utils/exec';
import { isDockerAvailable, resolveComposeCommand } from '../utils/docker';
import {
  generateAppDockerfile,
  generateProdDockerCompose,
  generateDockerignore,
  AppDockerTarget,
} from '../utils/docker-gen';
import { findProjectRoot } from '../utils/project-root';
import { loadManifest } from '../config/loader';
import { SvtonProjectConfig } from '../config/types';

export interface DockerOptions {
  force?: boolean;
  volumes?: boolean;
  service?: string;
}

const DOCKER_COMMANDS = ['init', 'build', 'up', 'down', 'logs'] as const;
type DockerCommand = (typeof DOCKER_COMMANDS)[number];
const DEFAULT_PROD_COMPOSE = 'docker-compose.prod.yml';

/** 可容器化的 app:nest/next/node(跳过 taro —— 构建产物,非服务)。 */
function dockerApps(manifest: SvtonProjectConfig): AppDockerTarget[] {
  return Object.entries(manifest.apps)
    .filter(([, a]) => a.type === 'nest' || a.type === 'next' || a.type === 'node')
    .map(([name, a]) => ({ name, dir: a.dir, type: a.type as AppDockerTarget['type'], port: a.port }));
}

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

/**
 * 确保 next 应用的 next.config.{js,mjs,ts} 含 `output: 'standalone'`。
 * 返回 'present'(已有)/ 'patched'(已补)/ 'missing-config'(找不到或无法自动补)。
 */
export async function ensureNextStandalone(root: string, dir: string): Promise<'present' | 'patched' | 'missing-config'> {
  for (const f of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
    const p = path.join(root, dir, f);
    if (!(await fs.pathExists(p))) continue;
    const txt = await fs.readFile(p, 'utf8');
    if (/output:\s*['"]standalone['"]/.test(txt)) return 'present';
    // 在配置对象起始花括号后插入。兼容 `const nextConfig = {` 与 `module.exports = {`
    const patched = txt.replace(/(const\s+\w+\s*=\s*\{)|(module\.exports\s*=\s*\{)/, (m) => `${m}\n  output: 'standalone',`);
    if (patched !== txt) {
      await fs.writeFile(p, patched);
      return 'patched';
    }
    return 'missing-config';
  }
  return 'missing-config';
}

async function dockerInit(root: string, manifest: SvtonProjectConfig, options: DockerOptions): Promise<void> {
  const apps = dockerApps(manifest);
  if (apps.length === 0) {
    logger.error('No containerizable apps found (need nest/next/node apps).');
    process.exit(1);
  }
  const projectName = await rootProjectName(root);
  const prodCompose = manifest.docker?.prodCompose ?? DEFAULT_PROD_COMPOSE;

  for (const app of apps) {
    const df = path.join(root, app.dir, 'Dockerfile');
    const rel = path.relative(root, df);
    if ((await fs.pathExists(df)) && !options.force) {
      logger.warn(`${rel} exists — use --force to overwrite (skipped)`);
    } else {
      await fs.ensureDir(path.dirname(df));
      await fs.writeFile(df, generateAppDockerfile(app));
      logger.success(`wrote ${rel}`);
    }
    if (app.type === 'next') {
      const r = await ensureNextStandalone(root, app.dir);
      if (r === 'patched') logger.success(`patched ${app.dir}/next.config → output: 'standalone'`);
      else if (r === 'missing-config')
        logger.warn(`${app.dir}: could not auto-add output:'standalone' — add it manually to next.config`);
    }
  }

  const composeAbs = path.join(root, prodCompose);
  if ((await fs.pathExists(composeAbs)) && !options.force) {
    logger.warn(`${prodCompose} exists — use --force to overwrite (skipped)`);
  } else {
    await fs.writeFile(composeAbs, generateProdDockerCompose({ projectName, apps }));
    logger.success(`wrote ${prodCompose}`);
  }

  const di = path.join(root, '.dockerignore');
  if ((await fs.pathExists(di)) && !options.force) {
    logger.warn('.dockerignore exists — use --force to overwrite (skipped)');
  } else {
    await fs.writeFile(di, generateDockerignore());
    logger.success('wrote .dockerignore');
  }

  logger.info('Next: `svton docker build` to build images, or `svton docker up` to build & start everything.');
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
  const composeFile = manifest.docker?.prodCompose ?? DEFAULT_PROD_COMPOSE;
  const composeAbs = path.join(root, composeFile);

  if (command === 'init') {
    await dockerInit(root, manifest, options);
    return;
  }

  // build/up/down/logs 都需要 docker + compose 文件
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
  const svc = options.service ? [options.service] : [];

  switch (command as DockerCommand) {
    case 'build':
      await runAndStream(composeCmd.bin, [...base, 'build', ...svc], { cwd: root });
      break;
    case 'up':
      await runAndStream(composeCmd.bin, [...base, 'up', '-d', '--build', ...svc], { cwd: root });
      break;
    case 'down':
      await runAndStream(composeCmd.bin, [...base, 'down', ...(options.volumes ? ['-v'] : [])], { cwd: root });
      break;
    case 'logs':
      await spawnStreaming(composeCmd.bin, [...base, 'logs', '-f', ...svc], { cwd: root });
      break;
  }
}
