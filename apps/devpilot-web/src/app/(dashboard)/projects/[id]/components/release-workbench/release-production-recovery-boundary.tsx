'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';

export function ReleaseProductionRecoveryBoundary(props: { run: ReleaseEvidenceProductionRun }) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const recovery = props.run.legacyPromotionRecovery;
  const blocker = props.run.promotionBlocker;
  return (
    <section
      className="border-t pt-4"
      aria-labelledby="release-production-recovery-title"
    >
      <h5
        id="release-production-recovery-title"
        className="text-sm font-semibold"
      >
        {t('releaseProductionRecoveryBoundaryTitle')}
      </h5>
      {recovery ? (
        <div className="mt-3 rounded-md border border-amber-500/40 p-3 text-sm">
          <p className="font-medium">{t('releaseProductionLegacyRecoveryTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {recovery.status === 'ambiguous'
              ? t('releaseProductionLegacyRecoveryAmbiguousDescription')
              : t('releaseProductionLegacyRecoveryDescription')}
          </p>
          <code className="mt-2 block break-all text-xs">
            {recovery.commandIds.join(', ')} · {recovery.phase || '—'} · {recovery.reasonCode}
          </code>
        </div>
      ) : blocker ? (
        <div className="mt-3 rounded-md border border-amber-500/40 p-3 text-sm">
          <p className="font-medium">{t('releaseProductionPromotionManualTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('releaseProductionPromotionManualIndependent')}
          </p>
          <ul className="mt-2 space-y-2 text-xs">
            {blocker.manualChecks.map((check) => (
              <li
                key={check.evaluationId}
                className="break-all"
              >
                <code>
                  {check.gateId} · {check.evaluationId}
                </code>
                <span className="block text-muted-foreground">
                  {locale.startsWith('zh') ? check.reason.zh : check.reason.en} · {check.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('releaseProductionRecoveryReadOnly')}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('releaseProductionRecoveryUnavailable')}
        </p>
      )}
    </section>
  );
}
