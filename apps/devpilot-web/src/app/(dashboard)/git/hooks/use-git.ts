/**
 * Git 集成数据 Hook
 *
 * 单一职责：管理 Git 连接列表、仓库列表与连接/断开操作。
 */

import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { GitConnection, GitRepo, GitConnectInput } from '../types';

export function useGit(isAuthenticated: boolean) {
  const [connections, setConnections] = useState<GitConnection[]>([]);
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadConnections = usePersistFn(async () => {
    try {
      setConnections(await apiRequest<GitConnection[]>('GET:/git/connections'));
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    if (isAuthenticated) loadConnections();
  }, [isAuthenticated, loadConnections]);

  const loadRepos = usePersistFn(async (provider: string) => {
    setSelectedProvider(provider);
    try {
      setRepos(await apiRequest<GitRepo[]>(`GET:/git/repos?provider=${provider}`));
    } catch (error) {
      console.error('Failed to load repos:', error);
    }
  });

  const connect = usePersistFn(async (input: GitConnectInput) => {
    await apiRequest('POST:/git/connect', input);
    await loadConnections();
  });

  const disconnect = usePersistFn(async (provider: string) => {
    await apiRequest(`DELETE:/git/connections/${provider}`);
    setConnections((prev) => prev.filter((c) => c.provider !== provider));
    setSelectedProvider((cur) => {
      if (cur === provider) {
        setRepos([]);
        return null;
      }
      return cur;
    });
  });

  return {
    connections,
    repos,
    selectedProvider,
    isLoading,
    loadRepos,
    connect,
    disconnect,
  };
}
