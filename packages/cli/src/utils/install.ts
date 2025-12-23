import { execSync } from 'child_process';
import { logger } from './logger';

export async function installDependencies(packageManager: string): Promise<void> {
  try {
    const command = getInstallCommand(packageManager);
    
    logger.debug(`Running: ${command}`);
    
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    
  } catch (error) {
    throw new Error(`Failed to install dependencies with ${packageManager}`);
  }
}

function getInstallCommand(packageManager: string): string {
  switch (packageManager) {
    case 'npm':
      return 'npm install';
    case 'yarn':
      return 'yarn install';
    case 'pnpm':
      return 'pnpm install';
    default:
      throw new Error(`Unsupported package manager: ${packageManager}`);
  }
}

export function checkPackageManagerAvailable(packageManager: string): boolean {
  try {
    execSync(`${packageManager} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
