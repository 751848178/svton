import { useState, useEffect } from 'react';
import type { TauriPlatform } from '@svton/agent-platform';

/**
 * Hook to fetch and track the current git branch for a working directory.
 * Refreshes on window focus.
 */
export function useGitBranch(platform: TauriPlatform, workingDir: string): string {
  const [branch, setBranch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchBranch() {
      try {
        const result = await platform.process.exec('git rev-parse --abbrev-ref HEAD', { cwd: workingDir });
        if (!cancelled && result.exitCode === 0) {
          setBranch(result.stdout.trim());
        }
      } catch { /* not a git repo */ }
    }
    fetchBranch();
    return () => { cancelled = true; };
  }, [workingDir, platform.process]);

  // Refresh on window focus
  useEffect(() => {
    const handler = () => {
      platform.process
        .exec('git rev-parse --abbrev-ref HEAD', { cwd: workingDir })
        .then((r) => { if (r.exitCode === 0) setBranch(r.stdout.trim()); })
        .catch(() => {});
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [workingDir, platform.process]);

  return branch;
}
