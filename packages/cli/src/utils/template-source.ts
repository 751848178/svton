import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger';
import { cleanupTemplateDir, downloadTemplateFromGitHub } from './github-template';

export interface ResolvedTemplateDir {
  templateDir: string;
  source: 'packaged' | 'workspace' | 'remote';
  cleanup: boolean;
}

export function getTemplateDirCandidates(baseDir: string = __dirname): Array<{ templateDir: string; source: 'packaged' | 'workspace' }> {
  const candidates = [
    { templateDir: path.resolve(baseDir, '..', 'templates'), source: 'packaged' as const },
    { templateDir: path.resolve(baseDir, '..', '..', 'templates'), source: 'packaged' as const },
    { templateDir: path.resolve(baseDir, '..', '..', '..', 'templates'), source: 'workspace' as const },
    { templateDir: path.resolve(baseDir, '..', '..', '..', '..', 'templates'), source: 'workspace' as const },
  ];

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.templateDir)) return false;
    seen.add(candidate.templateDir);
    return true;
  });
}

async function isTemplateDir(templateDir: string): Promise<boolean> {
  return (
    await fs.pathExists(path.join(templateDir, 'apps')) &&
    await fs.pathExists(path.join(templateDir, 'packages'))
  );
}

export async function findLocalTemplateDir(baseDir: string = __dirname): Promise<ResolvedTemplateDir | null> {
  for (const candidate of getTemplateDirCandidates(baseDir)) {
    if (await isTemplateDir(candidate.templateDir)) {
      return { ...candidate, cleanup: false };
    }
  }

  return null;
}

export async function resolveTemplateDir(): Promise<ResolvedTemplateDir> {
  const local = await findLocalTemplateDir();
  if (local) {
    logger.debug(`Using ${local.source} template directory: ${local.templateDir}`);
    return local;
  }

  logger.info('Local templates not found; downloading templates from remote archive...');
  const templateDir = await downloadTemplateFromGitHub();
  logger.info('Templates downloaded successfully');
  return { templateDir, source: 'remote', cleanup: true };
}

export async function cleanupResolvedTemplateDir(resolved: ResolvedTemplateDir | null): Promise<void> {
  if (resolved?.cleanup) {
    await cleanupTemplateDir(resolved.templateDir);
  }
}
