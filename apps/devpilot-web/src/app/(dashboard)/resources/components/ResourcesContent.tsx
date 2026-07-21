'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { feedback } from '@/components/ui/feedback/feedback';
import { useResources } from '../hooks/use-resources';
import { AddResourceModal } from './add-resource-modal';
import type { Resource, ResourceType } from '../types';

/**
 * 资源管理客户端视图。
 *
 * 接收首屏 server 数据 initialResources/initialResourceTypes（SWR fallback），
 * 添加/删除资源等交互在此完成。
 */
export function ResourcesContent({
  initialResources,
  initialResourceTypes,
}: {
  initialResources?: Resource[];
  initialResourceTypes?: ResourceType[];
}) {
  const t = useTranslations('resources');
  const tc = useTranslations('common');
  const { resources, resourceTypes, resourceTypeMap, isLoading, loadError, create, remove } =
    useResources(initialResources, initialResourceTypes);
  const [modalOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);
  // 删除确认弹窗状态（一个操作一个确认实例）
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null);

  const handleConfirmDelete = usePersistFn(async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      feedback.success(t('deleteSuccess'));
    } catch (error) {
      console.error('Failed to delete resource:', error);
      feedback.error(t('deleteFailed'));
    }
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <PageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={
            <button
              onClick={openModal}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t('addResource')}
            </button>
          }
        />
      </div>

      {loadError ? (
        <ErrorBanner
          message={t('loadFailed')}
          className="mb-4"
        />
      ) : null}

      {isLoading ? (
        <LoadingState text={tc('loading')} />
      ) : resources.length === 0 ? (
        <EmptyState
          text={t('noResources')}
          action={
            <button onClick={openModal} className="text-primary hover:underline">
              {t('addFirst')}
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <h3 className="font-medium">{resource.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {resourceTypeMap[resource.type]?.name || resource.type}
                </p>
              </div>
              <button
                onClick={() => setDeleteTarget(resource)}
                className="rounded px-3 py-1 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                {tc('delete')}
              </button>
            </div>
          ))}
        </div>
      )}

      <AddResourceModal
        open={modalOpen}
        resourceTypes={resourceTypes}
        onClose={closeModal}
        onCreate={create}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        tone="danger"
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirm')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
