'use client';

import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ProductionPromotionResumeInput } from '../types/environment-version.types';
import { promotionActionDomainError, type PromotionActionResult } from
  '../utils/promotion-action-result.model';

export function useProductionPromotionResume(
  projectId: string,
  environmentId: string,
  onChanged: () => Promise<unknown>,
) {
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const resume = useCallback(async (input: ProductionPromotionResumeInput) => {
    if (!projectId || !environmentId || inFlight.current) return null;
    inFlight.current = true;
    setResuming(true);
    setError('');
    try {
      const result = await apiRequest<PromotionActionResult>(
        `POST:/projects/${encodeURIComponent(projectId)}/delivery/environment-versions/${encodeURIComponent(environmentId)}/production-promotion/resume`,
        { ...input, idempotencyKey: crypto.randomUUID() },
      );
      await onChanged();
      setError(promotionActionDomainError(result) ?? '');
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      inFlight.current = false;
      setResuming(false);
    }
  }, [environmentId, onChanged, projectId]);
  return { resume, resuming, error };
}
