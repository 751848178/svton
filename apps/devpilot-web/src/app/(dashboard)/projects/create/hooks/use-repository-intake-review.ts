'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { errorMessage, mutate } from '../project-intake-mutation.utils';
import type {
  IntakeReviewItem,
  ProjectIntakeRun,
  RepositoryIntakeContract,
} from '../types';
import { defaultReviewItems, repositoryReviewBlockers } from '../repository-intake-review.utils';

interface Options {
  projectId: string | null;
  run: ProjectIntakeRun | null;
  setStep: (step: number) => void;
  setMutating: (value: boolean) => void;
  setError: (value: string) => void;
}

export function useRepositoryIntakeReview(options: Options) {
  const [contract, setContract] = useState<RepositoryIntakeContract | null>(null);
  const [items, setItems] = useState<IntakeReviewItem[]>([]);

  useEffect(() => {
    if (!options.projectId || !options.run) return;
    const { projectId, run } = options;
    void apiRequest<RepositoryIntakeContract>(
      `GET:/project-intake/${projectId}/analysis-runs/${run.id}/contract`,
    ).then((next) => {
      setContract(next);
      if (next.run.status === 'succeeded' && !next.snapshot) setItems(defaultReviewItems(next));
      if (next.snapshot) options.setStep(3);
    }).catch((caught) => options.setError(errorMessage(caught)));
  }, [options.projectId, options.run?.id, options.run?.status, options.setError]);

  const updateDecision = useCallback((suggestionId: string, decision: IntakeReviewItem['decision']) => {
    setItems((current) => current.map((item) =>
      item.suggestionId === suggestionId
        ? { ...item, decision, overrides: decision === 'edit' ? item.overrides || {} : undefined }
        : item));
  }, []);

  const updateOverride = useCallback((suggestionId: string, key: string, value: string) => {
    setItems((current) => current.map((item) => item.suggestionId === suggestionId
      ? { ...item, decision: 'edit', overrides: { ...item.overrides, [key]: value } }
      : item));
  }, []);

  const blockers = useMemo(() => repositoryReviewBlockers(contract, items), [contract, items]);

  const confirmAnalysis = useCallback(async () => {
    if (contract?.snapshot) { options.setStep(3); return; }
    if (!options.projectId || !options.run || blockers.length) return;
    await mutate(async () => {
      const next = await apiRequest<RepositoryIntakeContract>(
        `POST:/project-intake/${options.projectId}/analysis-runs/${options.run!.id}/review`,
        { items },
      );
      setContract(next);
      options.setStep(3);
    }, options.setMutating, options.setError);
  }, [blockers.length, contract?.snapshot, items, options]);

  return {
    contract,
    reviewItems: items,
    reviewBlockers: blockers,
    reviewLocked: Boolean(contract?.snapshot),
    reviewReady: Boolean(contract?.snapshot)
      || (contract?.run.status === 'succeeded' && items.length > 0 && blockers.length === 0),
    updateReviewDecision: updateDecision,
    updateReviewOverride: updateOverride,
    confirmAnalysis,
  };
}
