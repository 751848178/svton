import chalk from 'chalk';
import { logger } from '../utils/logger';
import { findProjectRoot } from '../utils/project-root';
import { loadManifest } from '../config/loader';
import { SvtonAppConfig } from '../config/types';

export interface InfoOptions {
  json?: boolean;
}

function typeLabel(type: SvtonAppConfig['type']): string {
  switch (type) {
    case 'nest':
      return chalk.cyan('nest');
    case 'next':
      return chalk.magenta('next');
    case 'taro':
      return chalk.green('taro');
    default:
      return chalk.gray('node');
  }
}

export async function info(options: InfoOptions = {}): Promise<void> {
  const root = await findProjectRoot();
  const manifest = await loadManifest(root);

  if (options.json) {
    // 合法 JSON，供编辑器/脚本消费
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    return;
  }

  const rel = (p: string) => p;
  logger.info(chalk.bold(`Svton project @ ${rel(root)}`));
  logger.info(chalk.gray(`pm: ${manifest.pm ?? 'pnpm'}  ·  schema: ${manifest.schema}  ·  apps: ${Object.keys(manifest.apps).length}`));
  logger.info('');

  logger.info(chalk.bold('Apps'));
  for (const [name, app] of Object.entries(manifest.apps)) {
    const port = app.port ? chalk.yellow(`:${app.port}`) : chalk.gray('—');
    const ready = app.ready?.http ? chalk.gray(` ready ${app.ready.http}`) : '';
    logger.info(`  ${chalk.green(name.padEnd(16))} ${typeLabel(app.type).padEnd(6)} ${port}${ready}`);
    logger.info(chalk.gray(`    dir: ${app.dir}`));
  }

  if (manifest.database) {
    logger.info('');
    logger.info(chalk.bold('Database'));
    logger.info(`  ${manifest.database.orm} @ ${manifest.database.dir}`);
  }

  if (manifest.services) {
    logger.info('');
    logger.info(chalk.bold('Services'));
    logger.info(`  compose: ${manifest.services.compose ?? 'docker-compose.yml'}`);
  }

  if (manifest.env) {
    logger.info('');
    logger.info(chalk.bold('Env'));
    logger.info(`  files: ${(manifest.env.files ?? ['.env', '.env.local']).join(', ')}  ·  example: ${manifest.env.example ?? '.env.example'}`);
  }
}
