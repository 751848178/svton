/**
 * 服务器数据 Hook
 *
 * 单一职责：服务器列表加载、新增、连接测试、删除。
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import type { Server, ServerInput, ConnectionTestResult } from '../types';

export function useServers() {
  const t = useTranslations('servers');
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Server | null>(null);

  const load = usePersistFn(async () => {
    setError('');
    try {
      setServers(await apiRequest<Server[]>('GET:/servers'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    load();
  }, [load]);

  const create = usePersistFn(async (input: ServerInput) => {
    await apiRequest('POST:/servers', input);
    await load();
  });

  const testConnection = usePersistFn(async (id: string) => {
    setTestingId(id);
    try {
      const result = await apiRequest<ConnectionTestResult>(`POST:/servers/${id}/test`);
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: result.status as Server['status'] } : s)),
      );
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
      setTestingId(null);
    }
  });

  const remove = usePersistFn((id: string) => {
    setDeleteTarget(servers.find((s) => s.id === id) ?? null);
  });

  const cancelDelete = usePersistFn(() => {
    setDeleteTarget(null);
  });

  const confirmDelete = usePersistFn(async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`DELETE:/servers/${deleteTarget.id}`);
      setServers((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      feedback.success(t('deleteSuccess'));
    } catch (error) {
      feedback.error(t('deleteFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  });

  return {
    servers,
    loading,
    testingId,
    error,
    deleteTarget,
    create,
    testConnection,
    remove,
    cancelDelete,
    confirmDelete,
    reload: load,
  };
}
