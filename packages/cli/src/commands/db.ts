import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { runSync, spawnStreaming, PackageManager } from '../utils/exec';
import { findProjectRoot } from '../utils/project-root';
import { loadManifest } from '../config/loader';
import { SvtonProjectConfig } from '../config/types';

export interface DbOptions {
  name?: string;
}

const DB_COMMANDS = ['generate', 'migrate', 'migrate:deploy', 'studio', 'seed', 'init'] as const;
type DbCommand = (typeof DB_COMMANDS)[number];

/** manifest 未声明 database.dir 时，扫描 apps 找含 prisma/schema.prisma 的目录。 */
async function detectPrismaDir(root: string, appDirs: string[]): Promise<string | null> {
  const matches: string[] = [];
  for (const dir of appDirs) {
    if (await fs.pathExists(path.join(root, dir, 'prisma', 'schema.prisma'))) matches.push(dir);
  }
  return matches.length === 1 ? matches[0] : null;
}

async function resolveDbDir(root: string, manifest: SvtonProjectConfig): Promise<string | null> {
  if (manifest.database?.dir) return manifest.database.dir;
  const appDirs = Object.values(manifest.apps ?? {}).map((a) => a.dir);
  return detectPrismaDir(root, appDirs);
}

async function appHasScript(root: string, dir: string, script: string): Promise<boolean> {
  const pkgPath = path.join(root, dir, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return false;
  try {
    const pkg = await fs.readJSON(pkgPath);
    return Boolean(pkg?.scripts && script in pkg.scripts);
  } catch {
    return false;
  }
}

/** `svton db <command>` action。 */
export async function db(command: string, options: DbOptions = {}): Promise<void> {
  if (!DB_COMMANDS.includes(command as DbCommand)) {
    logger.error(`Unknown db command: ${command}`);
    logger.info(`Available: ${DB_COMMANDS.join(', ')}`);
    process.exit(1);
  }

  const root = await findProjectRoot();
  const manifest = await loadManifest(root);
  const dbDir = await resolveDbDir(root, manifest);
  if (!dbDir) {
    logger.error('No Prisma app found. Set `database.dir` in svton.config.ts.');
    process.exit(1);
  }

  const pm: PackageManager = manifest.pm ?? 'pnpm';
  const cwd = path.join(root, dbDir);
  logger.info(`Prisma @ ${dbDir}`);

  switch (command as DbCommand) {
    case 'generate':
      runSync(`${pm} exec prisma generate`, { cwd });
      break;
    case 'migrate':
      runSync(`${pm} exec prisma migrate dev${options.name ? ` --name ${options.name}` : ''}`, { cwd });
      break;
    case 'migrate:deploy':
      runSync(`${pm} exec prisma migrate deploy`, { cwd });
      break;
    case 'studio':
      await spawnStreaming(pm, ['exec', 'prisma', 'studio'], { cwd });
      break;
    case 'seed':
      if (await appHasScript(root, dbDir, 'prisma:seed')) {
        runSync(`${pm} run prisma:seed`, { cwd });
      } else {
        logger.warn(`No "prisma:seed" script in ${dbDir} — skipping.`);
      }
      break;
    case 'init':
      if (await appHasScript(root, dbDir, 'db:init')) {
        runSync(`${pm} run db:init`, { cwd });
      } else {
        runSync(`${pm} exec prisma generate`, { cwd });
        runSync(`${pm} exec prisma migrate dev`, { cwd });
      }
      break;
  }
}
