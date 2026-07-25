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
  host: string;
  port: string;
  username: string;
  authType: 'password' | 'key';
  credentials: string;
}

export function useServerDetail(serverId: string) {
  const t = useTranslations('servers');
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useSetState<EditForm>({
    name: '',
    tags: '',
    host: '',
    port: '',
    username: '',
    authType: 'password',
    credentials: '',
  });

  const load = usePersistFn(async () => {
    try {
      const data = await apiRequest<Server>(`GET:/servers/${serverId}`);
      setServer(data);
      setEditForm({
        name: data.name,
        tags: data.tags?.join(', ') || '',
        host: data.host,
        port: String(data.port ?? ''),
        username: data.username,
        authType: (data.authType === 'key' ? 'key' : 'password'),
        credentials: '',
      });
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
      const body: Record<string, unknown> = {
        name: editForm.name,
        host: editForm.host,
        port: Number(editForm.port) || 0,
        username: editForm.username,
        authType: editForm.authType,
        tags: editForm.tags ? editForm.tags.split(',').map((tag) => tag.trim()) : [],
      };
      // credentials 为只写字段:留空=不变,非空=替换重加密
      if (editForm.credentials.trim()) body.credentials = editForm.credentials;
      await apiRequest(`PUT:/servers/${serverId}`, body);
      setEditing(false);
      feedback.success(t('saved'));
      await load();
    } catch (error) {
      feedback.error(t('saveFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
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
