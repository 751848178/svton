/**
 * 资源类型数据 Hook
 *
 * 单一职责：资源类型列表加载、停用。
 *
 * 列表走 SWR（useQueryLoose），支持 initialData（首屏 server 数据透传，避免 client 二次请求）；
 * 写操作后调用 mutate 刷新缓存。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { ResourceType } from '../types';

/** SWR 缓存 key（与 useQueryLoose 的 apiName 一致）。 */
const RESOURCE_TYPES_KEY = 'GET:/resource-types?includeDisabled=true';

export function useResourceTypes(initialResourceTypes?: ResourceType[] | undefined) {
  const t = useTranslations('admin');
  const {
    data,
    isLoading,
    mutate: refresh,
  } = useQueryLoose<ResourceType[]>(RESOURCE_TYPES_KEY, {
    fallback: initialResourceTypes,
  });
  const resourceTypes = data ?? [];

  const [creating, setCreating] = useState(false);
  const [editingType, setEditingType] = useState<ResourceType | null>(null);

  const openCreate = usePersistFn(() => setCreating(true));
  const openEdit = usePersistFn((type: ResourceType) => setEditingType(type));
  const closeModal = usePersistFn(() => {
    setCreating(false);
    setEditingType(null);
  });

  // 停用确认：状态提升到组件层 ConfirmDialog（参照 servers 删除确认范式）
  const [disableTargetId, setDisableTargetId] = useState<string | null>(null);
  const disableTarget = resourceTypes.find((type) => type.id === disableTargetId) ?? null;

  const requestDisable = usePersistFn((id: string) => setDisableTargetId(id));
  const cancelDisable = usePersistFn(() => setDisableTargetId(null));
  const confirmDisable = usePersistFn(async () => {
    if (!disableTarget) return;
    try {
      await apiRequest(`DELETE:/resource-types/${disableTarget.id}`);
      await mutate(RESOURCE_TYPES_KEY);
      feedback.success(t('disableTypeSuccess'));
    } catch (error) {
      feedback.error(t('disableTypeFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
      throw error;
    }
  });

  return {
    resourceTypes,
    loading: isLoading,
    creating,
    editingType,
    disableTarget,
    openCreate,
    openEdit,
    closeModal,
    requestDisable,
    cancelDisable,
    confirmDisable,
    reload: refresh,
  };
}
