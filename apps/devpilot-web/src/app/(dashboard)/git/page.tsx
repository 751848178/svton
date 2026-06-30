'use client';

import { useState } from 'react';
import { useBoolean } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader } from '@/components/ui';
import { useAuthStore } from '@/store/hooks';
import { useGit } from './hooks/use-git';
import { ConnectionCard } from './components/connection-card';
import { ConnectGitModal } from './components/connect-git-modal';
import { providerNames } from './constants';

export default function GitPage() {
  const { isAuthenticated } = useAuthStore();
  const [modalOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);
  const { connections, repos, selectedProvider, isLoading, loadRepos, connect, disconnect } =
    useGit(isAuthenticated);

  if (!isAuthenticated) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Git 集成"
        description="连接你的 Git 账号，将生成的项目直接推送到仓库"
        actions={
          <button
            onClick={openModal}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            连接账号
          </button>
        }
      />

      <div className="mb-8 mt-8">
        <h2 className="mb-4 text-lg font-medium">已连接账号</h2>
        {isLoading ? (
          <LoadingState text="加载中..." />
        ) : connections.length === 0 ? (
          <EmptyState
            text="还没有连接任何 Git 账号"
            action={
              <button
                onClick={openModal}
                className="text-primary hover:underline"
              >
                连接第一个账号
              </button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.provider}
                connection={conn}
                repos={repos}
                showRepos={selectedProvider === conn.provider}
                onViewRepos={loadRepos}
                onDisconnect={disconnect}
              />
            ))}
          </div>
        )}
      </div>

      {selectedProvider ? (
        <div>
          <h2 className="mb-4 text-lg font-medium">{providerNames[selectedProvider]} 仓库</h2>
        </div>
      ) : null}

      <ConnectGitModal
        open={modalOpen}
        onClose={closeModal}
        onConnect={connect}
      />
    </div>
  );
}
