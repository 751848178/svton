import { execSync } from 'child_process';
import { logger } from './logger';

export async function initGit(projectName: string): Promise<void> {
  try {
    // 检查是否已经是 git 仓库
    try {
      execSync('git status', { stdio: 'ignore' });
      logger.debug('Git repository already exists, skipping initialization');
      return;
    } catch {
      // 不是 git 仓库，继续初始化
    }

    // 初始化 git 仓库
    execSync('git init', { stdio: 'ignore' });
    
    // 添加所有文件
    execSync('git add .', { stdio: 'ignore' });
    
    // 提交初始代码
    execSync(`git commit -m "feat: initialize ${projectName} project"`, { 
      stdio: 'ignore' 
    });
    
    logger.debug('Git repository initialized successfully');
    
  } catch (error) {
    logger.warn('Failed to initialize Git repository');
    logger.debug(error instanceof Error ? error.message : String(error));
  }
}

export function checkGitAvailable(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
