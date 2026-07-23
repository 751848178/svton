'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { Button, ErrorBanner, StatusTag } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useServerDetail } from './hooks/use-server-detail';
import { ServerDetailView } from './components/server-detail-view';

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('servers');
  const tc = useTranslations('common');
  const serverId = params.id as string;
  const {
    server,
    loading,
    error,
    reload,
    testing,
    detecting,
    editing,
    editForm,
    setEditForm,
    setEditing,
    testConnection,
    detectServices,
    save,
    remove,
  } = useServerDetail(serverId);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = usePersistFn(async () => {
    await remove();
    router.push('/servers');
  });

  if (loading) return <LoadingState text={tc('loading')} />;

  if (error && !server) {
    return (
      <ErrorBanner
        message={error}
        onRetry={reload}
        retryLabel={tc('retry')}
      />
    );
  }

  if (!server) {
    return (
      <EmptyState
        text={t('serverNotFound')}
        action={
          <Button variant="ghost" onClick={() => router.push('/servers')}>
            {t('backToList')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/servers')}
          aria-label={t('backToList')}
        >
          ←
        </Button>
        <h1 className="text-2xl font-bold">{server.name}</h1>
        <StatusTag status={server.status} />
      </div>

      {error ? (
        <ErrorBanner
          variant="inline"
          message={error}
          onRetry={reload}
          retryLabel={tc('retry')}
        />
      ) : null}

      <ServerDetailView
        server={server}
        editing={editing}
        editForm={editForm}
        detecting={detecting}
        onEditFormChange={setEditForm}
        onStartEdit={() => setEditing(true)}
        onCancelEdit={() => setEditing(false)}
        onSave={save}
        onDetect={detectServices}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h2 className="mb-4 font-semibold">{tc('actions')}</h2>
          <div className="space-y-2">
            <Button
              block
              onClick={testConnection}
              loading={testing}
            >
              {testing ? t('testing') : t('testConnection')}
            </Button>
            <Button
              variant="outline"
              block
              onClick={() => router.push(`/proxy-configs?new=true&serverId=${server.id}`)}
            >
              {t('addProxyConfig')}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-destructive/50 p-6">
          <h2 className="mb-4 font-semibold text-destructive">{t('dangerZone')}</h2>
          <Button
            variant="destructive"
            block
            onClick={() => setDeleteOpen(true)}
          >
            {t('deleteServer')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title={t('deleteServerTitle')}
        description={t('deleteServerConfirm')}
        resourceName={server.name}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={handleDelete}
      />
    </div>
  );
}
