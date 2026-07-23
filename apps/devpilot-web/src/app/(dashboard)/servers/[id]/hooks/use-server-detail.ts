/**
 * 服务器详情数据 Hook
 *
 * 单一职责：加载服务器、测试连接、检测服务、保存编辑、删除。
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type { Server } from '../types';

interface EditForm {
  name: string;
  tags: string;
}

export function useServerDetail(serverId: string) {
  const t = useTranslations('servers');
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useSetState<EditForm>({ name: '', tags: '' });

  const load = usePersistFn(async () => {
    try {
      const data = await apiRequest<Server>(`GET:/servers/${serverId}`);
      setServer(data);
      setEditForm({ name: data.name, tags: data.tags?.join(', ') || '' });
      setError(null);
    } catch (error) {
      console.error('Failed to load server:', error);
      setError(t('detailLoadFailed'));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    load();
  }, [serverId, load]);

  const testConnection = usePersistFn(async () => {
    setTesting(true);
    try {
      const result = await apiRequest<{
        success: boolean;
        status: string;
        latency: number;
        message: string;
      }>(`POST:/servers/${serverId}/test`);
      setServer((prev) => (prev ? { ...prev, status: result.status as Server['status'] } : null));
      if (result.success) {
        feedback.success(result.message, {
          description: t('latencyMs', { latency: result.latency }),
        });
      } else {
        feedback.error(result.message);
      }
    } catch (error) {
      feedback.error(t('testFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setTesting(false);
    }
  });

  const detectServices = usePersistFn(async () => {
    setDetecting(true);
    try {
      const result = await apiRequest<{ services: Record<string, boolean>; message: string }>(
        `POST:/servers/${serverId}/detect`,
      );
      setServer((prev) => (prev ? { ...prev, services: result.services } : null));
      feedback.success(result.message);
    } catch (error) {
      feedback.error(t('detectFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDetecting(false);
    }
  });

  const save = usePersistFn(async () => {
    try {
      await apiRequest(`PUT:/servers/${serverId}`, {
        name: editForm.name,
        tags: editForm.tags ? editForm.tags.split(',').map((t) => t.trim()) : [],
      });
      setEditing(false);
      await load();
    } catch (error) {
      console.error('Save failed:', error);
    }
  });

  const remove = usePersistFn(async () => {
    await apiRequest(`DELETE:/servers/${serverId}`);
  });

  return {
    server,
    loading,
    error,
    reload: load,
    testing,
    detecting,
    editing,
    editForm,
    setEditForm,
    setEditing,
    testConnection,
    detectServices,
    save,
    remove,
  };
}
