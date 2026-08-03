'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  CreateReleaseOrderInput,
  ReleaseOrderItem,
  ReleaseOrderListResponse,
} from '../types/release-order.types';

export function useReleaseOrders(projectId: string) {
  const [items, setItems] = useState<ReleaseOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const result = await apiRequest<ReleaseOrderListResponse>(
        `GET:/projects/${projectId}/delivery/releases`,
      );
      setItems(result.items);
      setError('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (input: CreateReleaseOrderInput) => {
      setCreating(true);
      setError('');
      try {
        const created = await apiRequest<ReleaseOrderItem>(
          `POST:/projects/${projectId}/delivery/releases`,
          input,
        );
        setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        return created;
      } catch (caught) {
        setError(errorMessage(caught));
        return null;
      } finally {
        setCreating(false);
      }
    },
    [projectId],
  );

  return { items, loading, creating, error, load, create };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export type ReleaseOrdersHook = ReturnType<typeof useReleaseOrders>;
