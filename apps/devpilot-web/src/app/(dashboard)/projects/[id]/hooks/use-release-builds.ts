'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  ReleaseBuildItem,
  ReleaseBuildListResponse,
} from '../types/release-order.types';

export function useReleaseBuilds(
  projectId: string,
  releaseOrderId: string,
  onChanged: () => Promise<unknown>,
) {
  const [items, setItems] = useState<ReleaseBuildItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest<ReleaseBuildListResponse>(
        `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/builds`,
      );
      setItems(result.items);
      setError('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [projectId, releaseOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildLatest = useCallback(async () => {
    setBuilding(true);
    setError('');
    try {
      const run = await apiRequest<ReleaseBuildItem>(
        `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/builds`,
        {},
      );
      setItems((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      await onChanged();
      return run;
    } catch (caught) {
      setError(errorMessage(caught));
      return null;
    } finally {
      setBuilding(false);
    }
  }, [onChanged, projectId, releaseOrderId]);

  return { items, loading, building, error, load, buildLatest };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
