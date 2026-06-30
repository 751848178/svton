'use client';

import { useBoolean } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader } from '@/components/ui';
import { useServers } from './hooks/use-servers';
import { ServerCard } from './components/server-card';
import { AddServerModal } from './components/add-server-modal';

export default function ServersPage() {
  const { servers, loading, testingId, create, testConnection, remove } = useServers();
  const [modalOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="服务器管理"
        description="管理团队的服务器资源"
        actions={
          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + 添加服务器
          </button>
        }
      />

      {loading ? (
        <LoadingState text="加载中..." />
      ) : servers.length === 0 ? (
        <EmptyState
          text="还没有服务器"
          description="添加服务器来管理代理配置"
        />
      ) : (
        <div className="grid gap-4">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              testing={testingId === server.id}
              onTest={testConnection}
              onDelete={remove}
            />
          ))}
        </div>
      )}

      <AddServerModal
        open={modalOpen}
        onClose={closeModal}
        onCreate={create}
      />
    </div>
  );
}
