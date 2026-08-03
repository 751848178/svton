'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  ReleaseStagingDeploymentItem,
  ReleaseStagingDeploymentListResponse,
} from '../types/release-order.types';

export function useReleaseStagingDeployments(projectId: string, releaseOrderId: string) {
  const [items, setItems] = useState<ReleaseStagingDeploymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<ReleaseStagingDeploymentListResponse>(
        `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/staging-deployments`,
      );
      setItems(result.items);
      setError('');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [projectId, releaseOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const deploy = useCallback(async (manifestId: string) => {
    setDeploying(true);
    setError('');
    try {
      const run = await apiRequest<ReleaseStagingDeploymentItem>(
        `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/staging-deployments`,
        { manifestId },
      );
      setItems((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      return run;
    } catch (caught) {
      setError(message(caught));
      return null;
    } finally {
      setDeploying(false);
    }
  }, [projectId, releaseOrderId]);

  return { items, loading, deploying, error, load, deploy };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
