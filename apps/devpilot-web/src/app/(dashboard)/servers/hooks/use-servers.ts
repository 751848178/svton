/**
 * 服务器数据 Hook
 *
 * 单一职责：服务器列表加载、新增、连接测试、删除。
 */

import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { Server, ServerInput, ConnectionTestResult } from '../types';

export function useServers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = usePersistFn(async () => {
    try {
      setServers(await apiRequest<Server[]>('GET:/servers'));
    } catch (error) {
      console.error('Failed to load servers:', error);
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
      alert(result.message + (result.success ? ` (${result.latency}ms)` : ''));
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTestingId(null);
    }
  });

  const remove = usePersistFn(async (id: string) => {
    if (!confirm('确定要删除这个服务器吗？')) return;
    await apiRequest(`DELETE:/servers/${id}`);
    setServers((prev) => prev.filter((s) => s.id !== id));
  });

  return { servers, loading, testingId, create, testConnection, remove, reload: load };
}
