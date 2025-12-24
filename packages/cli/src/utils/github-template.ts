import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';
import { logger } from './logger';

const GITHUB_REPO = '751848178/svton';
const GITHUB_BRANCH = 'master';

interface DownloadOptions {
  repo?: string;
  branch?: string;
}

/**
 * 从 GitHub 下载模板到临时目录
 * @returns 模板目录路径
 */
export async function downloadTemplateFromGitHub(options: DownloadOptions = {}): Promise<string> {
  const repo = options.repo || GITHUB_REPO;
  const branch = options.branch || GITHUB_BRANCH;
  
  const tempDir = path.join(os.tmpdir(), `svton-template-${Date.now()}`);
  const archiveUrl = `https://github.com/${repo}/archive/refs/heads/${branch}.tar.gz`;
  
  logger.debug(`Downloading template from GitHub: ${archiveUrl}`);
  
  try {
    // 创建临时目录
    await fs.ensureDir(tempDir);
    
    // 下载并解压
    const tarFile = path.join(tempDir, 'template.tar.gz');
    
    // 使用 curl 下载（-L 跟随重定向，-f 失败时返回错误码）
    execSync(`curl -fsSL "${archiveUrl}" -o "${tarFile}"`, {
      stdio: 'pipe',
    });
    
    // 验证下载的文件是否为有效的 tar.gz
    const fileStats = await fs.stat(tarFile);
    if (fileStats.size < 1000) {
      throw new Error('Downloaded file is too small, possibly an error page');
    }
    
    // 解压
    execSync(`tar -xzf "${tarFile}" -C "${tempDir}"`, {
      stdio: 'pipe',
    });
    
    // 删除压缩包
    await fs.remove(tarFile);
    
    // 找到解压后的目录（格式为 repo-branch）
    const repoName = repo.split('/')[1];
    const extractedDir = path.join(tempDir, `${repoName}-${branch}`);
    
    // 返回 templates 目录路径
    const templateDir = path.join(extractedDir, 'templates');
    
    if (await fs.pathExists(templateDir)) {
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
    // 向上两级找到临时根目录
    const tempRoot = path.dirname(path.dirname(templateDir));
    if (tempRoot.includes('svton-template-')) {
      await fs.remove(tempRoot);
      logger.debug(`Cleaned up temp directory: ${tempRoot}`);
    }
  } catch (error) {
    logger.debug(`Failed to cleanup temp directory: ${error}`);
  }
}
