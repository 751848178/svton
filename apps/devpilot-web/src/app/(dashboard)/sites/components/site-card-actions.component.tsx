/** Site card action buttons. */
'use client';

import { useTranslations } from 'next-intl';
import type { useSites } from '../hooks/use-sites';
import type { Site } from '../types';

type SitesHook = ReturnType<typeof useSites>;

interface SiteCardActionsProps {
  site: Site;
  sites: SitesHook;
  canRenewTls: boolean;
}

const actionButtonClass =
  'rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50';

export function SiteCardActions({ site, sites, canRenewTls }: SiteCardActionsProps) {
  const t = useTranslations('sites');
  const tc = useTranslations('common');
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => sites.handleCreatePlan(site.id)}
        disabled={sites.planningId === site.id}
        className={actionButtonClass}
      >
        {sites.planningId === site.id
          ? sites.queueSiteRuns
            ? t('enqueuing')
            : t('generating')
          : sites.queueSiteRuns
            ? t('planEnqueue')
            : t('syncPlan')}
      </button>
      <button
        onClick={() => sites.handleSyncLive(site)}
        disabled={sites.syncingId === site.id}
        className={actionButtonClass}
      >
        {sites.syncingId === site.id
          ? sites.queueSiteRuns
            ? t('requestEnqueuing')
            : t('requesting')
          : sites.queueSiteRuns
            ? t('requestSyncEnqueue')
            : t('requestSync')}
      </button>
      <button
        onClick={() => sites.handleDiagnostics(site)}
        disabled={sites.diagnosingId === site.id}
        className={actionButtonClass}
      >
        {sites.diagnosingId === site.id
          ? sites.queueSiteRuns
            ? t('diagEnqueuing')
            : t('diagnosing')
          : sites.queueSiteRuns
            ? t('diagEnqueue')
            : t('diagnose')}
      </button>
      <button
        onClick={() => sites.handleOpenRestyStatus(site)}
        disabled={sites.probingRuntimeId === site.id}
        className={actionButtonClass}
      >
        {sites.probingRuntimeId === site.id
          ? sites.queueSiteRuns
            ? t('statusEnqueuing')
            : t('probing')
          : sites.queueSiteRuns
            ? t('statusEnqueue')
            : t('openrestyStatus')}
      </button>
      <button
        onClick={() => sites.handleOpenRestyModules(site)}
        disabled={sites.probingModulesId === site.id}
        className={actionButtonClass}
      >
        {sites.probingModulesId === site.id
          ? sites.queueSiteRuns
            ? t('modulesEnqueuing')
            : t('inventorying')
          : sites.queueSiteRuns
            ? t('modulesEnqueue')
            : t('openrestyModules')}
      </button>
      <button
        onClick={() => sites.handleOpenRestyModuleBaseline(site)}
        disabled={sites.checkingModuleBaselineId === site.id}
        className={actionButtonClass}
      >
        {sites.checkingModuleBaselineId === site.id
          ? sites.queueSiteRuns
            ? t('baselineEnqueuing')
            : t('checking')
          : sites.queueSiteRuns
            ? t('baselineEnqueue')
            : t('moduleBaseline')}
      </button>
      <button
        onClick={() => sites.handleSmokeCheck(site)}
        disabled={sites.smokingId === site.id}
        className={actionButtonClass}
      >
        {sites.smokingId === site.id
          ? sites.queueSiteRuns
            ? t('checkEnqueuing')
            : t('checking')
          : sites.queueSiteRuns
            ? t('smokeEnqueue')
            : t('smokeCheck')}
      </button>
      <button
        onClick={() => sites.handleTlsProbe(site)}
        disabled={sites.probingTlsId === site.id}
        className={actionButtonClass}
      >
        {sites.probingTlsId === site.id
          ? sites.queueSiteRuns
            ? t('probeEnqueuing')
            : t('probing')
          : sites.queueSiteRuns
            ? t('certProbeEnqueue')
            : t('certProbe')}
      </button>
      {canRenewTls && (
        <>
          <button
            onClick={() => sites.handleTlsRenew(site, true)}
            disabled={sites.renewingTlsId === site.id}
            className={actionButtonClass}
          >
            {sites.renewingTlsId === site.id
              ? sites.queueSiteRuns
                ? t('drillEnqueuing')
                : t('drilling')
              : sites.queueSiteRuns
                ? t('renewDrillEnqueue')
                : t('renewDrill')}
          </button>
          <button
            onClick={() => sites.handleTlsRenew(site, false)}
            disabled={sites.renewingTlsId === site.id}
            className={actionButtonClass}
          >
            {sites.renewingTlsId === site.id
              ? sites.queueSiteRuns
                ? t('requestEnqueuing')
                : t('requesting')
              : sites.queueSiteRuns
                ? t('requestRenewEnqueue')
                : t('requestRenew')}
          </button>
        </>
      )}
      <button
        onClick={() => sites.handleDelete(site.id)}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
      >
        {tc('delete')}
      </button>
    </div>
  );
}
