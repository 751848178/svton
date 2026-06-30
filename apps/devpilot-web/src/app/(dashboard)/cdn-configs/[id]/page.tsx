'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { Modal } from '@/components/ui';
import { useCdnConfig } from './hooks/use-cdn-config';
import { CdnConfigView } from './components/cdn-config-view';

export default function CDNConfigDetailPage() {
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

  const handlePurgeAll = usePersistFn(() => purge());
  const handlePurgePaths = usePersistFn(() => {
    purge(purgePaths.split('\n').filter((p) => p.trim()));
    closePurge();
    setPurgePaths('');
  });
  const handleDelete = usePersistFn(async () => {
    if (!confirm('确定要删除这个 CDN 配置吗？')) return;
    await remove();
    router.push('/cdn-configs');
  });

  if (loading) return <LoadingState text="加载中..." />;

  if (!config) {
    return (
      <EmptyState
        text="配置不存在"
        action={
          <button
            onClick={() => router.push('/cdn-configs')}
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
          onClick={() => router.push('/cdn-configs')}
          className="text-muted-foreground hover:text-foreground"
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
            <h2 className="mb-4 font-semibold">操作</h2>
            <div className="space-y-2">
              <button
                onClick={handlePurgeAll}
                disabled={purging}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {purging ? '清除中...' : '清除全部缓存'}
              </button>
              <button
                onClick={openPurge}
                className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                清除指定路径
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-destructive/50 p-6">
            <h2 className="mb-4 font-semibold text-destructive">危险操作</h2>
            <button
              onClick={handleDelete}
              className="w-full rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              删除配置
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={purgeModal}
        onClose={closePurge}
        title="清除指定路径缓存"
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">路径（每行一个）</span>
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
              取消
            </button>
            <button
              onClick={handlePurgePaths}
              disabled={purging || !purgePaths.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {purging ? '清除中...' : '清除'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
