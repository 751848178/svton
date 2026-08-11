'use client';

import { useCallback, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { promotionActionDomainError, type PromotionActionResult } from
  '../utils/promotion-action-result.model';

export function useProductionPromotionReconcile(
  projectId: string,
  environmentId: string,
  onChanged: () => Promise<unknown>,
) {
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState('');
  const reconcile = useCallback(async (promotionCommandId: string) => {
    if (!environmentId) return null;
    setReconciling(true);
    setError('');
    try {
      const result = await apiRequest<PromotionActionResult>(
        `POST:/projects/${projectId}/delivery/environment-versions/${environmentId}/production-promotion/reconcile`,
        { promotionCommandId, idempotencyKey: crypto.randomUUID() },
      );
      await onChanged();
      setError(promotionActionDomainError(result) ?? '');
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setReconciling(false);
    }
  }, [environmentId, onChanged, projectId]);
  return { reconcile, reconciling, error };
}
