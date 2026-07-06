'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { StatusTag, Modal } from '@/components/ui';
import { useProxyConfig } from './hooks/use-proxy-config';
import { ProxyConfigView } from './components/proxy-config-view';

export default function ProxyConfigDetailPage() {
  const t = useTranslations('proxyConfigs');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const configId = params.id as string;
  const { config, loading, syncing, sync, preview, remove } = useProxyConfig(configId);
  const [previewConfig, setPreviewConfig] = useState('');
  const [previewOpen, { setTrue: openPreview, setFalse: closePreview }] = useBoolean(false);

  const statusLabels: Record<string, string> = {
    active: t('statusActive'),
    error: t('statusError'),
    pending: t('statusPending'),
  };

  const handleSync = usePersistFn(() => sync());
  const handleDelete = usePersistFn(async () => {
    if (!confirm(t('deleteConfirm'))) return;
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

  if (loading) return <LoadingState text={tc('loading')} />;

  if (!config) {
    return (
      <EmptyState
        text={t('configNotFound')}
        action={
          <button
            onClick={() => router.push('/proxy-configs')}
            className="text-primary hover:underline"
          >
            {t('backToList')}
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
          label={statusLabels[config.status] || config.status}
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
        <h2 className="mb-4 font-semibold text-destructive">{t('dangerZone')}</h2>
        <button
          onClick={handleDelete}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          {t('deleteConfig')}
        </button>
      </div>

      <Modal
        open={previewOpen}
        onClose={closePreview}
        title={t('nginxConfigPreview')}
        width={768}
      >
        <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
          {previewConfig}
        </pre>
      </Modal>
    </div>
  );
}
