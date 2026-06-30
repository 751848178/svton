'use client';

import { useState } from 'react';
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
 */
export function KeysContent({ initialKeys }: { initialKeys?: SecretKey[] }) {
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
    if (!confirm('确定要删除这个密钥吗？此操作不可恢复。')) return;
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
        title="密钥中心"
        description="安全存储和管理各类密钥"
        actions={
          <div className="flex gap-2">
            <button
              onClick={openGen}
              className="rounded-lg border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50"
            >
              生成密钥
            </button>
            <button
              onClick={openStore}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              存储密钥
            </button>
          </div>
        }
      />

      <div className="grid gap-4">
        {keys.length === 0 ? (
          <EmptyState text="暂无存储的密钥" description='点击"生成密钥"或"存储密钥"开始' />
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
