'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { StatusTag, Modal } from '@/components/ui';
import { useProxyConfig } from './hooks/use-proxy-config';
import { ProxyConfigView } from './components/proxy-config-view';

const STATUS_LABELS: Record<string, string> = {
  active: '已生效',
  error: '错误',
  pending: '待同步',
};

export default function ProxyConfigDetailPage() {
  const params = useParams();
  const router = useRouter();
  const configId = params.id as string;
  const { config, loading, syncing, sync, preview, remove } = useProxyConfig(configId);
  const [previewConfig, setPreviewConfig] = useState('');
  const [previewOpen, { setTrue: openPreview, setFalse: closePreview }] = useBoolean(false);

  const handleSync = usePersistFn(() => sync());
  const handleDelete = usePersistFn(async () => {
    if (!confirm('确定要删除这个代理配置吗？')) return;
    await remove();
    router.push('/proxy-configs');
  });
  const handlePreview = usePersistFn(async () => {
    const cfg = await preview();
    if (cfg !== null) {
      setPreviewConfig(cfg);
      openPreview();
    }
  });
  const handleOpenServer = usePersistFn(() => {
    if (config?.server) router.push(`/servers/${config.server.id}`);
  });

  if (loading) return <LoadingState text="加载中..." />;

  if (!config) {
    return (
      <EmptyState
        text="配置不存在"
        action={
          <button
            onClick={() => router.push('/proxy-configs')}
            className="text-primary hover:underline"
          >
            返回列表
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/proxy-configs')}
          className="text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">{config.name}</h1>
        <StatusTag
          status={config.status}
          label={STATUS_LABELS[config.status] || config.status}
        />
      </div>

      <ProxyConfigView
        config={config}
        syncing={syncing}
        onSync={handleSync}
        onPreview={handlePreview}
        onOpenServer={handleOpenServer}
      />

      <div className="rounded-lg border border-destructive/50 p-6">
        <h2 className="mb-4 font-semibold text-destructive">危险操作</h2>
        <button
          onClick={handleDelete}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          删除配置
        </button>
      </div>

      <Modal
        open={previewOpen}
        onClose={closePreview}
        title="Nginx 配置预览"
        width={768}
      >
        <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
          {previewConfig}
        </pre>
      </Modal>
    </div>
  );
}
