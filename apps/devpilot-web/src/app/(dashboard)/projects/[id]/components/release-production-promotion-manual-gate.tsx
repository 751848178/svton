'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { Textarea } from '@/components/ui';
import { apiRequest } from '@/lib/api-client';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';

export function ReleaseProductionPromotionManualGate(props: {
  projectId: string;
  releaseOrderId: string;
  blocker: ReleaseEvidenceProductionRun['promotionBlocker'];
  onChanged: () => Promise<unknown>;
}) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const check = props.blocker?.manualChecks.find((item) => item.gateId === 'P03');
  if (!check) return null;
  const gateId = check.gateId;
  const evaluationId = check.evaluationId;
  const message = locale.startsWith('zh') ? check.reason.zh : check.reason.en;
  return (
    <section className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm" aria-labelledby="promotion-manual-gate-title">
      <h4 id="promotion-manual-gate-title" className="font-semibold">
        {t('releaseProductionPromotionManualTitle')}
      </h4>
      <p className="mt-1 text-amber-950">P03 · {message}</p>
      <p className="mt-1 text-xs text-amber-900">
        {t('releaseProductionPromotionManualIndependent')}
      </p>
      {check.confirmed ? (
        <p className="mt-3 font-medium text-emerald-800" role="status">
          {t('releaseProductionPromotionManualConfirmed')}
        </p>
      ) : <>
      <label className="mt-3 block font-medium">
        {t('releaseGateManualReason')}
        <Textarea
          className="mt-1 bg-white"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={3}
          maxLength={500}
        />
      </label>
      <Button
        className="mt-3 min-h-11"
        disabled={reason.trim().length < 3}
        loading={submitting}
        onClick={() => void confirm()}
      >
        {t('releaseProductionPromotionManualConfirmRetry')}
      </Button>
      </>}
      {error ? <p className="mt-2 text-destructive" role="alert">{error}</p> : null}
    </section>
  );

  async function confirm() {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(
        `POST:/projects/${encodeURIComponent(props.projectId)}/delivery/releases/${encodeURIComponent(props.releaseOrderId)}/gates/${gateId}/evaluations/${encodeURIComponent(evaluationId)}/confirm`,
        { reason: reason.trim() },
      );
      await props.onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  }
}
