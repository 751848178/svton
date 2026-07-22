'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { Modal } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { feedback } from '@/components/ui/feedback/feedback';
import { useCdnConfig } from './hooks/use-cdn-config';
import { CdnConfigView } from './components/cdn-config-view';

export default function CDNConfigDetailPage() {
  const t = useTranslations('cdnConfigs');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const configId = params.id as string;
  const {
    config,
    loading,
    purging,
    editing,
    editForm,
    setEditForm,
    setEditing,
    purge,
    save,
    remove,
  } = useCdnConfig(configId);
  const [purgePaths, setPurgePaths] = useState('');
  const [purgeModal, { setTrue: openPurge, setFalse: closePurge }] = useBoolean(false);
  const [deleteOpen, { setTrue: openDelete, setFalse: closeDelete }] = useBoolean(false);

  const handlePurgeAll = usePersistFn(() => purge());
  const handlePurgePaths = usePersistFn(() => {
    purge(purgePaths.split('\n').filter((p) => p.trim()));
    closePurge();
    setPurgePaths('');
  });
  const handleDelete = usePersistFn(async () => {
    try {
      await remove();
      feedback.success(t('deleteSuccess'));
      router.push('/cdn-configs');
    } catch (error) {
      feedback.error(t('deleteFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
      throw error;
    }
  });

  if (loading) return <LoadingState text={tc('loading')} />;

  if (!config) {
    return (
      <EmptyState
        text={t('configNotFound')}
        action={
          <button
            onClick={() => router.push('/cdn-configs')}
            className="link"
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
          onClick={() => router.push('/cdn-configs')}
          aria-label={t('backToList')}
          className="link"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">{config.name}</h1>
      </div>

      <CdnConfigView
        config={config}
        editing={editing}
        editForm={editForm}
        onEditFormChange={setEditForm}
        onStartEdit={() => setEditing(true)}
        onCancelEdit={() => setEditing(false)}
        onSave={save}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-start-3">
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 font-semibold">{tc('actions')}</h2>
            <div className="space-y-2">
              <button
                onClick={handlePurgeAll}
                disabled={purging}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {purging ? t('purging') : t('purgeAllCache')}
              </button>
              <button
                onClick={openPurge}
                className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {t('purgePathsAction')}
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-destructive/50 p-6">
            <h2 className="mb-4 font-semibold text-destructive">{t('dangerZone')}</h2>
            <button
              onClick={openDelete}
              className="w-full rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              {t('deleteConfig')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) closeDelete();
        }}
        tone="danger"
        title={t('deleteConfigTitle')}
        description={t('deleteConfigDescription')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={handleDelete}
      />

      <Modal
        open={purgeModal}
        onClose={closePurge}
        title={t('purgePaths')}
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('pathsHint')}</span>
            <textarea
              value={purgePaths}
              onChange={(e) => setPurgePaths(e.target.value)}
              rows={5}
              className="w-full rounded-md border px-3 py-2 font-mono text-sm"
              placeholder={'/images/*\n/css/*\n/js/*'}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={closePurge}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {tc('cancel')}
            </button>
            <button
              onClick={handlePurgePaths}
              disabled={purging || !purgePaths.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {purging ? t('purging') : t('purge')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
