/**
 * Git 连接卡片 + 仓库列表
 *
 * 单一职责：展示单个已连接账号 + 其仓库，触发查看/断开。
 */

import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import type { GitConnection, GitRepo } from '../types';
import { providerNames } from '../constants';

interface ConnectionCardProps {
  connection: GitConnection;
  repos: GitRepo[];
  showRepos: boolean;
  onViewRepos: (provider: string) => void;
  onDisconnect: (provider: string) => void;
}

export function ConnectionCard({
  connection,
  repos,
  showRepos,
  onViewRepos,
  onDisconnect,
}: ConnectionCardProps) {
  const handleView = usePersistFn(() => onViewRepos(connection.provider));
  const handleDisconnect = usePersistFn(() => onDisconnect(connection.provider));

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-bold">
            {connection.provider[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-medium">{providerNames[connection.provider]}</h3>
            <p className="text-sm text-muted-foreground">@{connection.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleView}
            className="rounded border px-3 py-1 text-sm transition-colors hover:bg-accent"
          >
            查看仓库
          </button>
          <button
            onClick={handleDisconnect}
            className="rounded px-3 py-1 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            断开
          </button>
        </div>
      </div>

      {showRepos ? <RepoList repos={repos} /> : null}
    </div>
  );
}

function RepoList({ repos }: { repos: GitRepo[] }) {
  if (repos.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">没有找到仓库</p>;
  }
  return (
    <div className="mt-3 space-y-2">
      {repos.map((repo) => (
        <a
          key={repo.id}
          href={repo.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border p-4 transition-colors hover:border-primary"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{repo.name}</h4>
              <p className="text-sm text-muted-foreground">{repo.description || '无描述'}</p>
            </div>
            {repo.private ? <Tag color="default">私有</Tag> : null}
          </div>
        </a>
      ))}
    </div>
  );
}
