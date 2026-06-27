import { execFileSync } from 'child_process';
import { logger } from './logger';

interface InstallOptions {
  registry?: string;
}

export async function installDependencies(packageManager: string, options: InstallOptions = {}): Promise<void> {
  try {
    const { command, args } = getInstallCommand(packageManager, options.registry);
    
    logger.debug(`Running: ${[command, ...args].join(' ')}`);
    
    execFileSync(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    
  } catch (error) {
    throw new Error(`Failed to install dependencies with ${packageManager}`);
  }
}

export function getInstallCommand(packageManager: string, registry?: string): { command: string; args: string[] } {
  const args = ['install'];
  if (registry) {
    args.push(`--registry=${registry}`);
  }

  switch (packageManager) {
    case 'npm':
      return { command: 'npm', args };
    case 'yarn':
      return { command: 'yarn', args };
    case 'pnpm':
      return { command: 'pnpm', args };
    default:
      throw new Error(`Unsupported package manager: ${packageManager}`);
  }
}

export function checkPackageManagerAvailable(packageManager: string): boolean {
  try {
    execFileSync(packageManager, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
