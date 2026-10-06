'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Drawer } from '@svton/ui';
import type { ReleaseGateCatalog } from '../../types/release-gate.types';
import { formatIso } from '../../utils/release-time.utils';
import { ReleaseGateManualConfirmation } from '../release-gate-manual-confirmation';
import type { ReleasePreflightCheckRow } from './release-preflight-checks.model';
import { FlowStatusTag } from './release-flow-status-tag';
import { releaseGateStatusTone } from '../release-gate-summary.model';

export function ReleasePreflightEvidenceDrawer(props: {
  catalog: ReleaseGateCatalog;
  row: ReleasePreflightCheckRow | null;
  confirmingGateId: string;
  confirmationError: string;
  onConfirmManual: (gateId: string, evaluationId: string, reason: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const locale = useLocale();
  const check = props.row?.check;
  const localize = (text: { zh: string; en: string }) =>
    locale.startsWith('zh') ? text.zh : text.en;
  return (
    <Drawer
      open={Boolean(check)}
      onClose={props.onClose}
      title={
        check ? `${check.id} · ${localize(check.title)}` : t('releasePreflightEvidenceDrawerTitle')
      }
      description={t('releasePreflightEvidenceDrawerDescription')}
      width="min(960px, 100vw)"
      ariaCloseLabel={tc('close')}
    >
      {check && props.row ? (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FlowStatusTag
              status={releaseGateStatusTone(check.status)}
              label={t(`releaseGateStatus.${check.status}`)}
            />
            <span className="text-xs text-muted-foreground">
              {t(`releasePreflightImpact.${props.row.impact}`)}
            </span>
          </div>
          <section className="rounded-lg border p-4">
            <h4 className="font-semibold">{t('releaseGateReasonLabel')}</h4>
            <p className="mt-2 text-sm">{localize(check.reason)}</p>
            <code className="mt-2 block break-all text-xs text-muted-foreground">
              {check.reasonCode}
            </code>
          </section>
          <dl className="grid gap-3 rounded-lg border p-4 text-xs sm:grid-cols-2">
            <Fact
              label={t('releaseGateProviderLabel')}
              value={check.providerKey || '—'}
            />
            <Fact
              label={t('releaseGateCapabilityLabel')}
              value={check.capabilityId || '—'}
            />
            <Fact
              label={t('releaseGateEvidenceLabel')}
              value={check.evidenceRef || '—'}
            />
            <Fact
              label={t('releaseGateCheckedAtLabel')}
              value={formatIso(check.checkedAt)}
            />
            <Fact
              label={t('releaseGateExpiresAtLabel')}
              value={formatIso(check.expiresAt)}
            />
            <Fact
              label={t('releasePreflightPersistedAt')}
              value={formatIso(check.persistedAt)}
            />
            <Fact
              label={t('releasePreflightPersistedStatus')}
              value={check.persistedStatus}
            />
            <Fact
              label={t('releasePreflightFreshness')}
              value={freshness(check.fresh, t)}
            />
            <Fact
              label={t('releasePreflightEvaluationId')}
              value={check.evaluationId}
            />
            <Fact
              label={t('releasePreflightEvaluationInputHash')}
              value={check.evaluationInputHash}
            />
            <Fact
              label={t('releasePreflightDefinitionVersion')}
              value={check.definitionVersion}
            />
            <Fact
              label={t('releasePreflightCatalogVersion')}
              value={`${props.catalog.catalogVersion} · ${props.catalog.capabilityVersion}`}
            />
            <Fact
              label={t('releasePreflightDispositions')}
              value={check.dispositions.join(', ') || '—'}
            />
            <Fact
              label={t('releasePreflightWaiver')}
              value={
                check.waiver ? t('releasePreflightWaiverPresent') : t('releasePreflightWaiverNone')
              }
            />
          </dl>
          {check.dispositions.includes('manual') &&
          ['manual', 'confirmed'].includes(props.row.impact) ? (
            <ReleaseGateManualConfirmation
              check={check}
              confirming={props.confirmingGateId === check.id}
              error={props.confirmationError}
              onConfirm={props.onConfirmManual}
            />
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className="mt-1 break-all font-mono">{props.value}</dd>
    </div>
  );
}
function freshness(value: boolean | null, t: ReturnType<typeof useTranslations>) {
  return value === null
    ? t('releaseGateMetadataUnavailable')
    : t(value ? 'releasePreflightFresh' : 'releasePreflightStale');
}
