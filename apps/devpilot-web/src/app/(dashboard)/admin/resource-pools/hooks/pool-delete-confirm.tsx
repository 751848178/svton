'use client';

/**
 * 资源池删除确认桥
 *
 * useResourcePools 的 hook 实例活在 ResourcePoolsContent 内部（该组件由并行任务负责，不可改），
 * 而确认弹窗只能由 page.tsx 渲染。这里用一个 Context 桥：
 * hook 通过 setHandle 发布 { pendingPool, confirmRemove, cancelRemove }，
 * page.tsx 渲染的 ResourcePoolsDeleteConfirmDialog 消费并展示 ConfirmDialog。
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ResourcePool } from '../types';

export interface PoolDeleteConfirmHandle {
  pendingPool: ResourcePool | null;
  confirmRemove: () => Promise<void>;
  cancelRemove: () => void;
}

interface PoolDeleteConfirmChannel {
  handle: PoolDeleteConfirmHandle | null;
  setHandle: (handle: PoolDeleteConfirmHandle | null) => void;
}

const PoolDeleteConfirmContext = createContext<PoolDeleteConfirmChannel | null>(null);

/** hook 侧使用：拿到发布句柄的通道；不在 Provider 内时返回 null。 */
export function usePoolDeleteConfirmChannel() {
  return useContext(PoolDeleteConfirmContext);
}

export function ResourcePoolsConfirmProvider({ children }: { children: ReactNode }) {
  const [handle, setHandle] = useState<PoolDeleteConfirmHandle | null>(null);
  const value = useMemo(() => ({ handle, setHandle }), [handle]);
  return <PoolDeleteConfirmContext.Provider value={value}>{children}</PoolDeleteConfirmContext.Provider>;
}

/** page.tsx 侧渲染：消费 hook 发布的确认状态，展示删除 ConfirmDialog。 */
export function ResourcePoolsDeleteConfirmDialog() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const channel = useContext(PoolDeleteConfirmContext);
  const handle = channel?.handle ?? null;

  return (
    <ConfirmDialog
      open={Boolean(handle?.pendingPool)}
      onOpenChange={(open) => {
        if (!open) handle?.cancelRemove();
      }}
      tone="danger"
      title={t('poolDeleteConfirmTitle')}
      description={t('poolDeleteConfirmDescription')}
      confirmLabel={tc('delete')}
      cancelLabel={tc('cancel')}
      onConfirm={() => {
        void handle?.confirmRemove();
      }}
    />
  );
}
