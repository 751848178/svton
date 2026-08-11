'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type {
  LocalizedGateText,
  ReleaseGateCheck,
  ReleaseGatePhase,
} from '../types/release-gate.types';
import { releaseGateStatusTone } from './release-gate-summary.model';
import { ReleaseGateManualConfirmation } from './release-gate-manual-confirmation';

interface Props {
  phase: ReleaseGatePhase;
  checks: ReleaseGateCheck[];
  localize: (text: LocalizedGateText) => string;
  locale: string;
  confirmingGateId: string;
  confirmationError: string;
  onConfirmManual: (gateId: string, evaluationId: string, reason: string) => Promise<boolean>;
}

export function ReleaseGatePhaseSection(props: Props) {
  const t = useTranslations('projects');
  return (
    <section
      aria-labelledby={`release-gate-phase-${props.phase}`}
      className="space-y-2 rounded-lg border p-3"
    >
      <div className="flex items-center justify-between">
        <h3
          id={`release-gate-phase-${props.phase}`}
          className="text-sm font-semibold"
        >
          {t(`releaseGatePhase.${props.phase}`)}
        </h3>
        <span className="text-xs text-muted-foreground">{props.checks.length}</span>
      </div>
      <div className="space-y-2">
        {props.checks.map((check) => (
          <article
            key={check.id}
            className="rounded-md border bg-background p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <span>
                <strong className="font-mono">{check.id}</strong> · {props.localize(check.title)}
              </span>
              <StatusTag
                status={releaseGateStatusTone(check.status)}
                label={t(`releaseGateStatus.${check.status}`)}
              />
            </div>
            <dl className="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-2">
              <GateMetadata
                label={t('releaseGateProviderLabel')}
                value={check.providerKey || t('releaseGateMetadataUnavailable')}
              />
              <GateMetadata
                label={t('releaseGateReasonLabel')}
                value={props.localize(check.reason)}
              />
              <GateMetadata
                label={t('releaseGateEvidenceLabel')}
                value={check.evidenceRef || t('releaseGateMetadataUnavailable')}
              />
              <GateMetadata
                label={t('releaseGateCheckedAtLabel')}
                value={formatTime(check.checkedAt, props.locale, t('releaseGateMetadataUnavailable'))}
              />
              <GateMetadata
                label={t('releaseGateExpiresAtLabel')}
                value={formatTime(check.expiresAt, props.locale, t('releaseGateMetadataUnavailable'))}
              />
              <GateMetadata
                className="max-[820px]:hidden"
                label={t('releaseGateCapabilityLabel')}
                value={check.capabilityId || t('releaseGateTargetCapability')}
              />
            </dl>
            {check.status === 'manual' && check.dispositions.includes('manual') ? (
              <ReleaseGateManualConfirmation
                check={check}
                confirming={props.confirmingGateId === check.id}
                error={props.confirmationError}
                onConfirm={props.onConfirmManual}
              />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function GateMetadata({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}

function formatTime(value: string | null, locale: string, fallback: string) {
  return value ? new Date(value).toLocaleString(locale) : fallback;
}
