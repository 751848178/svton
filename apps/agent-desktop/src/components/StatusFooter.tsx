import React, { useMemo } from 'react';
import type { AgentConfig } from '@svton/agent-core';
import type { TauriPlatform } from '@svton/agent-platform';
import { useGitBranch } from '@/hooks/useGitBranch';

interface StatusFooterProps {
  config: AgentConfig | null;
  platform: TauriPlatform;
  onEditConfig: () => void;
}

export function StatusFooter({ config, platform, onEditConfig }: StatusFooterProps) {
  const workingDir = config?.workingDir || '/';
  const gitBranch = useGitBranch(platform, workingDir);

  // Shorten working directory to last 2 segments
  const shortDir = useMemo(() => {
    const parts = workingDir.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length <= 2) return workingDir;
    return '.../' + parts.slice(-2).join('/');
  }, [workingDir]);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 border-t border-gray-800 text-xs font-mono text-gray-500 select-none shrink-0">
      <span className={config ? 'text-cyan-600' : 'text-gray-600'}>
        {config?.model || 'no model'}
      </span>
      <span className="text-gray-700">&middot;</span>
      <span>{shortDir}</span>
      {gitBranch && (
        <>
          <span className="text-gray-700">&middot;</span>
          <span className="text-green-700">{gitBranch}</span>
        </>
      )}
      <div className="flex-1" />
      <button
        onClick={onEditConfig}
        className="text-gray-600 hover:text-gray-400 transition-colors"
      >
        config
      </button>
    </div>
  );
}
