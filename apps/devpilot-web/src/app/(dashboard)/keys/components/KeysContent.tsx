'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBoolean, usePersistFn, useSetState } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader } from '@/components/ui';
import { useKeys } from '../hooks/use-keys';
import { KeyCard } from './key-card';
import { GenerateKeyModal } from './generate-key-modal';
import { StoreKeyModal } from './store-key-modal';
import type { SecretKey, KeyInput } from '../types';

/**
 * 密钥中心客户端视图。
 *
 * 接收首屏 server 数据 initialKeys（SWR fallback），交互（生成/存储/删除/查看明文）在此完成。
 * 所有可见文案通过 next-intl 的 useTranslations('keys') 读取，便于多语言。
 */
export function KeysContent({ initialKeys }: { initialKeys?: SecretKey[] }) {
  const t = useTranslations('keys');
  const { keys, loading, generate, store, revealValue, remove } = useKeys(initialKeys);
  const [revealed, setRevealed] = useSetState<Record<string, string>>({});
  const [storeInitial, setStoreInitial] = useState<Partial<KeyInput>>({});
  const [genOpen, { setTrue: openGen, setFalse: closeGen }] = useBoolean(false);
  const [storeOpen, { setTrue: openStore, setFalse: closeStore }] = useBoolean(false);

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

  const handleDelete = usePersistFn(async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    await remove(id);
  });

  const handleStorePrefill = usePersistFn((input: Partial<KeyInput>) => {
    setStoreInitial(input);
    openStore();
  });

  if (loading) {
    return <LoadingState text="" />;
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
              className="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
            >
              {t('generate')}
            </button>
            <button
              onClick={openStore}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {t('store')}
            </button>
          </div>
        }
      />

      <div className="grid gap-4">
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
        onClose={closeStore}
        onStore={store}
      />
    </div>
  );
}
