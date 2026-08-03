'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  ProductionReleaseListResponse,
  ProductionReleasePreview,
  ProductionReleaseRun,
} from '../types/release-order.types';

export function useProductionReleases(
  projectId: string,
  releaseOrderId: string,
  manifestId: string,
) {
  const [preview, setPreview] = useState<ProductionReleasePreview | null>(null);
  const [items, setItems] = useState<ProductionReleaseRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [runs, nextPreview] = await Promise.all([
        apiRequest<ProductionReleaseListResponse>(
          `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-releases`,
        ),
        manifestId
          ? apiRequest<ProductionReleasePreview>(
              `GET:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-preview?manifestId=${encodeURIComponent(manifestId)}`,
            )
          : Promise.resolve(null),
      ]);
      setItems(runs.items);
      setPreview(nextPreview);
      setError('');
    } catch (caught) {
      setPreview(null);
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [manifestId, projectId, releaseOrderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = useCallback(async () => {
    if (!preview) return null;
    setConfirming(true);
    setError('');
    try {
      const run = await apiRequest<ProductionReleaseRun>(
        `POST:/projects/${projectId}/delivery/releases/${releaseOrderId}/production-releases`,
        {
          manifestId: preview.snapshot.manifest.id,
          expectedInputHash: preview.inputHash,
          idempotencyKey: crypto.randomUUID(),
        },
      );
      setItems((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      return run;
    } catch (caught) {
      setError(message(caught));
      return null;
    } finally {
      setConfirming(false);
    }
  }, [preview, projectId, releaseOrderId]);

  return { preview, items, loading, confirming, error, load, confirm };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
