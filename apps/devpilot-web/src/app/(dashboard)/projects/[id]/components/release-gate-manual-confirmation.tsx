'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import type { ReleaseGateCheck } from '../types/release-gate.types';

interface Props {
  check: ReleaseGateCheck;
  confirming: boolean;
  error: string;
  onConfirm: (gateId: string, evaluationId: string, reason: string) => Promise<boolean>;
}

export function ReleaseGateManualConfirmation(props: Props) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const [reason, setReason] = useState('');
  const waiver = manualWaiver(props.check.waiver);
  if (waiver) {
    return (
      <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs">
        <strong>{t('releaseGateManualConfirmed')}</strong>
        <p className="mt-1 text-emerald-900">{waiver.reason}</p>
        <p className="mt-1 text-emerald-800">
          {new Date(waiver.confirmedAt).toLocaleString(locale)} ·{' '}
          {props.check.waiverExpiresAt
            ? t('releaseGateManualExpires', {
                time: new Date(props.check.waiverExpiresAt).toLocaleString(locale),
              })
            : t('releaseGateManualNoExpiry')}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
      <label className="font-medium">
        {t('releaseGateManualReason')}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={3}
          maxLength={500}
          className="mt-1 block min-h-16 w-full rounded border bg-white p-2"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-amber-900">{t('releaseGateManualPermissionBoundary')}</span>
        <Button
          size="sm"
          disabled={reason.trim().length < 3}
          loading={props.confirming}
          onClick={async () => {
            if (await props.onConfirm(props.check.id, props.check.evaluationId, reason)) {
              setReason('');
            }
          }}
        >
          {t('releaseGateManualConfirm')}
        </Button>
      </div>
      {props.error ? <p role="alert" className="mt-2 text-destructive">{props.error}</p> : null}
    </div>
  );
}

function manualWaiver(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    row.kind !== 'manual_confirmation' ||
    typeof row.reason !== 'string' ||
    typeof row.confirmedAt !== 'string'
  ) return null;
  return { reason: row.reason, confirmedAt: row.confirmedAt };
}
