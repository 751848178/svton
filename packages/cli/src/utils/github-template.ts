import fs from 'fs-extra';
import path from 'path';
import { execFileSync } from 'child_process';
import os from 'os';
import { logger } from './logger';

const DEFAULT_GITHUB_REPO = '751848178/svton';
const DEFAULT_GITHUB_BRANCH = 'master';
const DEFAULT_DOWNLOAD_TIMEOUT_SECONDS = 30;

interface DownloadOptions {
  repo?: string;
  branch?: string;
  archiveUrl?: string;
  timeoutSeconds?: number;
}

export function resolveTemplateArchiveUrl(options: DownloadOptions = {}): string {
  if (options.archiveUrl || process.env.SVTON_TEMPLATE_ARCHIVE_URL) {
    return (options.archiveUrl || process.env.SVTON_TEMPLATE_ARCHIVE_URL)!;
  }

  const repo = options.repo || process.env.SVTON_TEMPLATE_REPO || DEFAULT_GITHUB_REPO;
  const branch = options.branch || process.env.SVTON_TEMPLATE_BRANCH || DEFAULT_GITHUB_BRANCH;
  return `https://github.com/${repo}/archive/refs/heads/${branch}.tar.gz`;
}

function resolveTimeoutSeconds(options: DownloadOptions): number {
  const value = options.timeoutSeconds ?? Number(process.env.SVTON_TEMPLATE_DOWNLOAD_TIMEOUT || DEFAULT_DOWNLOAD_TIMEOUT_SECONDS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DOWNLOAD_TIMEOUT_SECONDS;
}

async function findTemplateDir(tempDir: string): Promise<string | null> {
  const direct = path.join(tempDir, 'templates');
  if (await fs.pathExists(direct)) return direct;

  const entries = await fs.readdir(tempDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const templateDir = path.join(tempDir, entry.name, 'templates');
    if (await fs.pathExists(templateDir)) return templateDir;
  }

  return null;
}

/**
 * 从远端归档下载模板到临时目录
 * @returns 模板目录路径
 */
export async function downloadTemplateFromGitHub(options: DownloadOptions = {}): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `svton-template-${Date.now()}`);
  const archiveUrl = resolveTemplateArchiveUrl(options);
  const timeoutSeconds = String(resolveTimeoutSeconds(options));
  
  logger.debug(`Downloading template archive: ${archiveUrl}`);
  
  try {
    // 创建临时目录
    await fs.ensureDir(tempDir);
    
    // 下载并解压
    const tarFile = path.join(tempDir, 'template.tar.gz');
    
    // 使用 curl 下载（-L 跟随重定向，-f 失败时返回错误码）
    execFileSync('curl', ['-fsSL', '--connect-timeout', timeoutSeconds, '--max-time', timeoutSeconds, archiveUrl, '-o', tarFile], {
      stdio: 'pipe',
    });
    
    // 验证下载的文件是否为有效的 tar.gz
    const fileStats = await fs.stat(tarFile);
    if (fileStats.size < 1000) {
      throw new Error('Downloaded file is too small, possibly an error page');
    }
    
    // 解压
    execFileSync('tar', ['-xzf', tarFile, '-C', tempDir], {
      stdio: 'pipe',
    });
    
    // 删除压缩包
    await fs.remove(tarFile);
    
    const templateDir = await findTemplateDir(tempDir);
    
    if (templateDir) {
      logger.debug(`Template downloaded to: ${templateDir}`);
      return templateDir;
    }
    
    throw new Error('Templates directory not found in downloaded repository');
  } catch (error) {
    // 清理临时目录
    await fs.remove(tempDir).catch(() => {});
    throw error;
  }
}

/**
 * 清理临时模板目录
 */
export async function cleanupTemplateDir(templateDir: string): Promise<void> {
  try {
    let current = templateDir;
    while (current !== path.dirname(current)) {
      if (path.basename(current).startsWith('svton-template-')) {
        await fs.remove(current);
        logger.debug(`Cleaned up temp directory: ${current}`);
        return;
      }
      current = path.dirname(current);
    }
  } catch (error) {
    logger.debug(`Failed to cleanup temp directory: ${error}`);
  }
}
