import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { runAndStream } from '../utils/exec';
import { resolveComposeCommand, isDockerAvailable } from '../utils/docker';
import { generateDockerCompose } from '../utils/compose';
import { findProjectRoot } from '../utils/project-root';
import { loadManifest } from '../config/loader';

export interface ServicesOptions {
  force?: boolean;
  volumes?: boolean;
}

const SERVICES_COMMANDS = ['init', 'up', 'down', 'status'] as const;
type ServicesCommand = (typeof SERVICES_COMMANDS)[number];

async function composePath(root: string, manifest: any): Promise<string> {
  return path.join(root, manifest.services?.compose ?? 'docker-compose.yml');
}

async function rootProjectName(root: string): Promise<string> {
  const pkgPath = path.join(root, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJSON(pkgPath);
      if (pkg?.name) return pkg.name.replace(/^@[^/]+\//, '');
    } catch {
      /* ignore */
    }
  }
  return path.basename(root);
}

/** `svton services <command>` action。 */
export async function services(command: string, options: ServicesOptions = {}): Promise<void> {
  if (!SERVICES_COMMANDS.includes(command as ServicesCommand)) {
    logger.error(`Unknown services command: ${command}`);
    logger.info(`Available: ${SERVICES_COMMANDS.join(', ')}`);
    process.exit(1);
  }

  const root = await findProjectRoot();
  const manifest = await loadManifest(root);
  const compose = await composePath(root, manifest);

  if (command === 'init') {
    if ((await fs.pathExists(compose)) && !options.force) {
      logger.warn(`${path.relative(root, compose)} already exists. Use --force to overwrite.`);
      return;
    }
    const projectName = await rootProjectName(root);
    await fs.writeFile(compose, generateDockerCompose({ projectName }));
    logger.success(`Wrote ${path.relative(root, compose)} (MySQL + Redis for "${projectName}").`);
    logger.info('Run `svton services up` to start them.');
    return;
  }

  // up / down / status 都需要 Docker 与 compose 文件
  if (!isDockerAvailable()) {
    logger.error('Docker not found. Install Docker Desktop, or run the services individually.');
    process.exit(1);
  }
  const composeCmd = resolveComposeCommand();
  if (!composeCmd) {
    logger.error('Neither `docker compose` nor `docker-compose` is available.');
    process.exit(1);
  }
  if (!(await fs.pathExists(compose))) {
    logger.error(`No ${path.relative(root, compose)} found. Run \`svton services init\` to generate one.`);
    process.exit(1);
  }

  const args = [...composeCmd.args];
  switch (command as ServicesCommand) {
    case 'up':
      await runAndStream(composeCmd.bin, [...args, 'up', '-d'], { cwd: root });
      break;
    case 'down':
      await runAndStream(composeCmd.bin, [...args, 'down', ...(options.volumes ? ['-v'] : [])], { cwd: root });
      break;
    case 'status':
      await runAndStream(composeCmd.bin, [...args, 'ps'], { cwd: root });
      break;
  }
}
