'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ReleaseOrderDetail } from '../types/release-order.types';

export function useReleaseOrderDetail(projectId: string, releaseOrderId: string) {
  const [detail, setDetail] = useState<ReleaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<ReleaseOrderDetail>(
        `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}`,
      );
      setDetail(result);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [projectId, releaseOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { detail, loading, error, load };
}
