/**
 * CDN 配置详情数据 Hook
 *
 * 单一职责：加载配置、清除缓存（全量/指定路径）、保存编辑、删除。
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type { CDNConfig } from '../types';

interface EditForm {
  name: string;
  origin: string;
}

export function useCdnConfig(configId: string) {
  const t = useTranslations('cdnConfigs');
  const [config, setConfig] = useState<CDNConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [editForm, setEditForm] = useSetState<EditForm>({ name: '', origin: '' });
  const [editing, setEditing] = useState(false);

  const load = usePersistFn(async () => {
    try {
      const data = await apiRequest<CDNConfig>(`GET:/cdn-configs/${configId}`);
      setConfig(data);
      setEditForm({ name: data.name, origin: data.origin });
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    load();
  }, [configId, load]);

  const purge = usePersistFn(async (paths?: string[]) => {
    setPurging(true);
    try {
      await apiRequest(`POST:/cdn-configs/${configId}/purge`, { paths });
      feedback.success(t('purgeSuccess'));
    } catch (error) {
      console.error('Purge failed:', error);
      feedback.error(t('purgeFailed'));
    } finally {
      setPurging(false);
    }
  });

  const save = usePersistFn(async () => {
    try {
      await apiRequest(`PUT:/cdn-configs/${configId}`, editForm);
      setEditing(false);
      await load();
    } catch (error) {
      console.error('Save failed:', error);
      feedback.error(t('saveFailed'));
    }
  });

  const remove = usePersistFn(async () => {
    await apiRequest(`DELETE:/cdn-configs/${configId}`);
  });

  return {
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
  };
}
