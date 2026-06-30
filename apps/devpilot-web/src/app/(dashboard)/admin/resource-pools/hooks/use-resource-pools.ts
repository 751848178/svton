/**
 * 资源池数据 Hook
 *
 * 单一职责：资源池列表加载、新增/编辑/删除。
 * 表单状态用 useSetState 统一管理。
 *
 * 列表走 SWR（useQueryLoose），支持 initialData（首屏 server 数据透传，避免 client 二次请求）；
 * 写操作后调用 mutate 刷新缓存。
 */

import { useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { ResourcePool, PoolForm } from '../types';
import { EMPTY_FORM } from '../types';

/** SWR 缓存 key（与 useQueryLoose 的 apiName 一致）。 */
const POOLS_KEY = 'GET:/resource-pools';

export function useResourcePools(initialPools?: ResourcePool[] | undefined) {
  const { data, isLoading } = useQueryLoose<ResourcePool[]>(POOLS_KEY, {
    fallback: initialPools,
  });
  const pools = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<ResourcePool | null>(null);
  const [form, setForm] = useSetState<PoolForm>(EMPTY_FORM);

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
    }
  });

  const remove = usePersistFn(async (id: string) => {
    if (!confirm('确定要删除这个资源池吗？')) return;
    try {
      await apiRequest(`DELETE:/resource-pools/${id}`);
      await mutate(POOLS_KEY);
    } catch (error) {
      console.error('Failed to delete pool:', error);
    }
  });

  return {
    pools,
    loading: isLoading,
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
