import { execSync } from 'child_process';
import { isCommandAvailable } from './exec';

/** Docker 是否可用。 */
export function isDockerAvailable(): boolean {
  return isCommandAvailable('docker');
}

/**
 * 返回可用的 compose 调用方式。
 * 优先新版 `docker compose`（v2 子命令），回退旧版 `docker-compose`。
 */
export function resolveComposeCommand(): { bin: string; args: string[] } | null {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return { bin: 'docker', args: ['compose'] };
  } catch {
    try {
      execSync('docker-compose --version', { stdio: 'ignore' });
      return { bin: 'docker-compose', args: [] };
    } catch {
      return null;
    }
  }
}
