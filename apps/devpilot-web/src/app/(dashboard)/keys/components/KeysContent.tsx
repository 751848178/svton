'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn, useSetState } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { feedback } from '@/components/ui/feedback/feedback';
import { useKeys } from '../hooks/use-keys';
import { KeyCard } from './key-card';
import { GenerateKeyModal } from './generate-key-modal';
import { StoreKeyModal } from './store-key-modal';
import type { SecretKey, KeyInput, KeyScopeFilter } from '../types';

interface KeysContentProps {
  initialKeys?: SecretKey[];
  /** 作用域过滤（来自 URL ?projectId=&environmentId=）。无值即全局视图。 */
  scope?: KeyScopeFilter;
}

/**
 * 密钥中心客户端视图。
 *
 * 接收首屏 server 数据 initialKeys（SWR fallback），交互（生成/存储/删除/查看明文）在此完成。
 * 当 scope 带有 projectId/environmentId 时：顶部展示上下文横幅，列表仅展示该作用域密钥，
 * 新增密钥会自动绑定到该作用域（store 写入透传 scope）。
 */
export function KeysContent({ initialKeys, scope }: KeysContentProps) {
  const t = useTranslations('keys');
  const tc = useTranslations('common');
  const { keys, loading, error, generate, store, revealValue, remove, refresh } = useKeys(
    scope,
    initialKeys,
  );
  const [revealed, setRevealed] = useSetState<Record<string, string>>({});
  const [storeInitial, setStoreInitial] = useState<Partial<KeyInput>>({});
  const [genOpen, { setTrue: openGen, setFalse: closeGen }] = useBoolean(false);
  const [storeOpen, { setTrue: openStore, setFalse: closeStore }] = useBoolean(false);
  const [deleteTarget, setDeleteTarget] = useState<SecretKey | null>(null);

  const hasScope = Boolean(scope?.projectId || scope?.environmentId);

  const handleReveal = usePersistFn(async (id: string) => {
    if (revealed[id]) {
      setRevealed({ [id]: '' });
      return;
    }
    try {
      const value = await revealValue(id);
      setRevealed({ [id]: value });
    } catch (error) {
      console.error('Failed to reveal key:', error);
    }
  });

  const handleDelete = usePersistFn((id: string) => {
    setDeleteTarget(keys.find((key) => key.id === id) ?? null);
  });

  const handleConfirmDelete = usePersistFn(async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      feedback.success(t('deleteSuccess'));
    } catch (error) {
      feedback.error(t('deleteFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
      throw error;
    }
  });

  const handleStorePrefill = usePersistFn((input: Partial<KeyInput>) => {
    setStoreInitial(input);
    openStore();
  });

  // 存储时把作用域注入输入，使新密钥绑定到当前 project/environment。
  const handleStore = usePersistFn(async (input: KeyInput) => {
    await store({ ...input, projectId: scope?.projectId, environmentId: scope?.environmentId });
  });

  if (loading) {
    return <LoadingState text={tc('loading')} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <div className="flex gap-2">
            <button
              onClick={openGen}
              className="rounded-lg border border-primary px-4 py-2 text-primary hover:bg-primary/10"
            >
              {t('generate')}
            </button>
            <button
              onClick={openStore}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              {t('store')}
            </button>
          </div>
        }
      />

      {hasScope ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary">
          {t('scopedBanner', {
            projectId: scope?.projectId ?? '',
            environmentId: scope?.environmentId ?? '',
          })}
        </div>
      ) : null}

      {error ? (
        <ErrorBanner
          message={t('loadFailed')}
          onRetry={refresh}
          retryLabel={tc('retry')}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {keys.length === 0 ? (
          <EmptyState text={t('noKeys')} />
        ) : (
          keys.map((key) => (
            <KeyCard
              key={key.id}
              secretKey={key}
              revealedValue={revealed[key.id] || ''}
              onReveal={handleReveal}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <GenerateKeyModal
        open={genOpen}
        onClose={closeGen}
        onGenerate={generate}
        onStorePrefill={handleStorePrefill}
      />
      <StoreKeyModal
        open={storeOpen}
        initial={storeInitial}
        scope={scope}
        onClose={closeStore}
        onStore={handleStore}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        tone="danger"
        title={t('deleteTitle')}
        description={t('deleteConfirm')}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
