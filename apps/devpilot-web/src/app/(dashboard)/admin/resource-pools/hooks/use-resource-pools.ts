/**
 * 资源池数据 Hook
 *
 * 单一职责：资源池列表加载、新增/编辑/删除。
 * 表单状态用 useSetState 统一管理。
 *
 * 列表走 SWR（useQueryLoose），支持 initialData（首屏 server 数据透传，避免 client 二次请求）；
 * 写操作后调用 mutate 刷新缓存。
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import { feedback } from '@/components/ui/feedback/feedback';
import type { ResourcePool, PoolForm } from '../types';
import { EMPTY_FORM } from '../types';
import { usePoolDeleteConfirmChannel } from './pool-delete-confirm';

/** SWR 缓存 key（与 useQueryLoose 的 apiName 一致）。 */
const POOLS_KEY = 'GET:/resource-pools';

export function useResourcePools(initialPools?: ResourcePool[] | undefined) {
  const t = useTranslations('admin');
  const confirmChannel = usePoolDeleteConfirmChannel();
  const { data, isLoading, error, mutate: refresh } = useQueryLoose<ResourcePool[]>(POOLS_KEY, {
    fallback: initialPools,
  });
  const pools = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<ResourcePool | null>(null);
  const [form, setForm] = useSetState<PoolForm>(EMPTY_FORM);
  // 删除确认：remove 只记录目标并打开弹窗（由 page.tsx 渲染的 ConfirmDialog 确认后执行）
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const openCreate = usePersistFn(() => {
    setEditingPool(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  });

  const openEdit = usePersistFn((pool: ResourcePool) => {
    setEditingPool(pool);
    setForm({
      type: pool.type,
      name: pool.name,
      endpoint: pool.endpoint,
      capacity: pool.capacity,
      adminConfig: {},
    });
    setModalOpen(true);
  });

  const closeModal = usePersistFn(() => {
    setModalOpen(false);
    setEditingPool(null);
  });

  const submit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPool) {
        await apiRequest(`PUT:/resource-pools/${editingPool.id}`, form);
      } else {
        await apiRequest('POST:/resource-pools', form);
      }
      closeModal();
      await mutate(POOLS_KEY);
    } catch (error) {
      console.error('Failed to save pool:', error);
      feedback.error(t('poolSaveFailed'));
    }
  });

  const remove = usePersistFn((id: string) => {
    setPendingDeleteId(id);
  });

  const cancelRemove = usePersistFn(() => {
    setPendingDeleteId(null);
  });

  const confirmRemove = usePersistFn(async () => {
    if (!pendingDeleteId) return;
    try {
      await apiRequest(`DELETE:/resource-pools/${pendingDeleteId}`);
      await mutate(POOLS_KEY);
      setPendingDeleteId(null);
      feedback.success(t('poolDeleteSuccess'));
    } catch (error) {
      console.error('Failed to delete pool:', error);
      feedback.error(t('poolDeleteFailed'));
    }
  });

  // 把确认状态发布给 page.tsx 渲染的 ResourcePoolsDeleteConfirmDialog
  const pendingDeletePool = useMemo(
    () => pools.find((pool) => pool.id === pendingDeleteId) ?? null,
    [pools, pendingDeleteId],
  );
  useEffect(() => {
    if (!confirmChannel) return;
    confirmChannel.setHandle({ pendingPool: pendingDeletePool, confirmRemove, cancelRemove });
    return () => confirmChannel.setHandle(null);
  }, [confirmChannel, pendingDeletePool, confirmRemove, cancelRemove]);

  return {
    pools,
    loading: isLoading,
    loadError: error,
    refresh,
    modalOpen,
    editingPool,
    form,
    setForm,
    openCreate,
    openEdit,
    closeModal,
    submit,
    remove,
  };
}
