'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ReleaseGateCatalog } from '../types/release-gate.types';

export function useReleaseGateCatalog(projectId: string, releaseOrderId: string) {
  const [catalog, setCatalog] = useState<ReleaseGateCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<ReleaseGateCatalog>(
        `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/gates`,
      );
      setCatalog(result);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [projectId, releaseOrderId]);

  useEffect(() => { void load(); }, [load]);
  return { catalog, loading, error, load };
}
