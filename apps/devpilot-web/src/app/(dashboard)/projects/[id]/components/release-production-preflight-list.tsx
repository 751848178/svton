'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ProductionReleasePreview } from '../types/release-order.types';

type Check = ProductionReleasePreview['preflight']['checks'][number];

export function ReleaseProductionPreflightList({
  checks,
}: {
  checks: Check[];
}) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const blockers = checks.filter((check) => check.status !== 'checked');
  const passed = checks.filter((check) => check.status === 'checked');
  return (
    <section className="rounded-lg border p-4" aria-labelledby="production-preflight-title">
      <h4 id="production-preflight-title" className="text-sm font-semibold">
        {t('releaseProductionPreflightTitle')}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('releaseProductionPreflightSummary', {
          passed: passed.length,
          total: checks.length,
        })}
      </p>
      <div className="mt-3 space-y-2">
        {blockers.map((check) => (
          <GateRow key={check.id} check={check} locale={locale} />
        ))}
      </div>
      {passed.length > 0 ? (
        <details className="mt-3 rounded-md border bg-muted/20">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-xs font-medium">
            {t('releaseProductionPreflightPassed', { count: passed.length })}
          </summary>
          <div className="space-y-2 border-t p-3">
            {passed.map((check) => (
              <GateRow key={check.id} check={check} locale={locale} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function GateRow({ check, locale }: { check: Check; locale: string }) {
  const t = useTranslations('projects');
  const reason = locale.startsWith('zh') ? check.reason.zh : check.reason.en;
  return (
    <div className="rounded-md border p-3 text-xs" data-production-gate={check.id}>
      <div className="flex flex-wrap items-center gap-2">
        <strong>{check.id}</strong>
        <span className={check.status === 'checked' ? 'text-emerald-700' : 'text-amber-800'}>
          {check.deferredUntilApproval
            ? t('releaseProductionGateStatus_next_step')
            : t(`releaseProductionGateStatus_${check.status}`)}
        </span>
        {check.localOnly ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
            {t('releaseProductionAcceptanceOnlyBadge')}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-muted-foreground">{reason}</p>
      {check.deferredUntilApproval ? (
        <p className="mt-1 text-amber-900">{t('releaseProductionGateDeferredUntilApproval')}</p>
      ) : null}
      <p className="mt-1 break-all text-[11px] text-muted-foreground">
        {check.providerKey || t('releaseProductionProviderUnavailable')} ·{' '}
        {check.checkedAt || t('releaseProductionNotChecked')}
      </p>
      {!check.deferredUntilApproval && check.status !== 'checked' && check.repairHref ? (
        <a href={check.repairHref} className="mt-2 inline-flex min-h-11 items-center font-medium text-primary underline">
          {t('releaseProductionRepairGate', { gate: check.id })}
        </a>
      ) : null}
    </div>
  );
}
