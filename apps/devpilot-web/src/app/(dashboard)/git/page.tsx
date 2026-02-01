'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

interface GitConnection {
  provider: string;
  username: string;
  connectedAt: string;
}

interface GitRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
}

const providerNames: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  gitee: 'Gitee',
};

export default function GitPage() {
  const { isAuthenticated } = useAuthStore();
  const [connections, setConnections] = useState<GitConnection[]>([]);
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadConnections();
    }
  }, [isAuthenticated]);

  const loadConnections = async () => {
    try {
      const data = await api.get<GitConnection[]>('/git/connections');
      setConnections(data);
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRepos = async (provider: string) => {
    setSelectedProvider(provider);
    try {
      const data = await api.get<GitRepo[]>(`/git/repos?provider=${provider}`);
      setRepos(data);
    } catch (error) {
      console.error('Failed to load repos:', error);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`确定要断开 ${providerNames[provider]} 连接吗？`)) return;

    try {
      await api.delete(`/git/connections/${provider}`);
      setConnections(connections.filter((c) => c.provider !== provider));
      if (selectedProvider === provider) {
        setSelectedProvider(null);
        setRepos([]);
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Git 集成</h1>
          <p className="text-muted-foreground">
            连接你的 Git 账号，将生成的项目直接推送到仓库
          </p>
        </div>
        <button
          onClick={() => setShowConnectModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          连接账号
        </button>
      </div>

      {/* 已连接的账号 */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-4">已连接账号</h2>
        {isLoading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : connections.length === 0 ? (
          <div className="text-center py-8 border rounded-lg">
            <p className="text-muted-foreground mb-4">还没有连接任何 Git 账号</p>
            <button
              onClick={() => setShowConnectModal(true)}
              className="text-primary hover:underline"
            >
              连接第一个账号
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {connections.map((conn) => (
              <div
                key={conn.provider}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                    {conn.provider[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium">{providerNames[conn.provider]}</h3>
                    <p className="text-sm text-muted-foreground">@{conn.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadRepos(conn.provider)}
                    className="px-3 py-1 text-sm border rounded hover:bg-accent transition-colors"
                  >
                    查看仓库
                  </button>
                  <button
                    onClick={() => handleDisconnect(conn.provider)}
                    className="px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors"
                  >
                    断开
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 仓库列表 */}
      {selectedProvider && (
        <div>
          <h2 className="text-lg font-medium mb-4">
            {providerNames[selectedProvider]} 仓库
          </h2>
          {repos.length === 0 ? (
            <p className="text-muted-foreground">没有找到仓库</p>
          ) : (
            <div className="space-y-2">
              {repos.map((repo) => (
                <a
                  key={repo.id}
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{repo.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {repo.description || '无描述'}
                      </p>
                    </div>
                    {repo.private && (
                      <span className="px-2 py-1 text-xs bg-muted rounded">私有</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {showConnectModal && (
        <ConnectGitModal
          onClose={() => setShowConnectModal(false)}
          onSuccess={() => {
            setShowConnectModal(false);
            loadConnections();
          }}
        />
      )}
    </div>
  );
}

function ConnectGitModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [provider, setProvider] = useState<'github' | 'gitlab' | 'gitee'>('github');
  const [accessToken, setAccessToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await api.post('/git/connect', { provider, accessToken });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">连接 Git 账号</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Git 提供商</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
              className="w-full px-3 py-2 border rounded-md bg-background"
            >
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
              <option value="gitee">Gitee</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Access Token</label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="输入你的 Personal Access Token"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {provider === 'github' && '需要 repo 权限的 Personal Access Token'}
              {provider === 'gitlab' && '需要 api 权限的 Personal Access Token'}
              {provider === 'gitee' && '需要 projects 权限的私人令牌'}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !accessToken}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? '连接中...' : '连接'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
