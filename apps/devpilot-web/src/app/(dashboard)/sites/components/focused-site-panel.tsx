/** 聚焦站点接管面板 - 展示聚焦站点的接管绑定/探测/计划/运行记录。 */
'use client';
import { useTranslations } from 'next-intl';
import type { useSites } from '../hooks/use-sites';
import { runtimeTypeLabels } from '../constants';
import { readRecord, readString, readRecordArray } from '../utils';
import { createSiteTakeoverForm, isPreviewSitePlaceholder } from '../utils-takeover';
import {
  describeRuntime,
  getStatusLabel,
  getStatusClass,
  formatTlsCertificateSummary,
} from '../utils-format';
import { FocusedSitePlanRunSummary } from './focused-site-plan-run-summary.component';
import { TakeoverBindingForm } from './takeover-binding-form';
type SitesHook = ReturnType<typeof useSites>;
export function FocusedSitePanel({ sites }: { sites: SitesHook }) {
  const t = useTranslations('sites');
  const focusedSite = sites.focusedSite;
  if (!focusedSite) return null;
  const focusedPlan = sites.plans[focusedSite.id] || null;
  const focusedRecentRuns = sites.syncRuns[focusedSite.id] || [];
  const focusedRuntimeConfig = readRecord(focusedSite.runtimeConfig);
  const focusedTls = readRecord(focusedSite.tls);
  const focusedTlsAssets = readRecordArray(focusedTls.assets);
  const focusedTlsSummary = formatTlsCertificateSummary(focusedTls);
  const focusedTakeoverForm =
    sites.takeoverForms[focusedSite.id] || createSiteTakeoverForm(focusedSite);
  const focusedIsPreviewPlaceholder = isPreviewSitePlaceholder(focusedSite);
  const updateFocusedTakeoverForm = sites.updateFocusedTakeoverForm;
  const handleSaveTakeoverBinding = sites.handleSaveTakeoverBinding;
  const handleActivatePreviewSite = sites.handleActivatePreviewSite;
  return (
    <section className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{t('takeoverSiteTitle', { name: focusedSite.name })}</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(focusedSite.status)}`}
            >
              {getStatusLabel(focusedSite.status)}
            </span>
            <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {runtimeTypeLabels[focusedSite.runtimeType] || focusedSite.runtimeType}
            </span>
          </div>
          <div className="font-mono text-sm">{focusedSite.primaryDomain}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{t('projectLabel', { name: focusedSite.project?.name || t('notLinked') })}</span>
            <span>{t('environmentLabel', { name: focusedSite.environment?.name || t('notBound') })}</span>
            <span>
              {t('serverLabelColon')}
              {focusedSite.server
                ? `${focusedSite.server.name} (${focusedSite.server.host})`
                : t('notLinked')}
            </span>
            <span>{t('upstreamLabel', { name: describeRuntime(focusedSite.runtimeType, focusedRuntimeConfig) })}</span>
          </div>
          {focusedTlsSummary && (
            <div className="text-xs text-muted-foreground">{t('certLabel', { name: focusedTlsSummary })}</div>
          )}
          <div className="text-xs text-muted-foreground">
            {t('focusedPanelHint')}
          </div>
          {focusedIsPreviewPlaceholder && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
              {t('previewPlaceholderWarning')}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => sites.handleCreatePlan(focusedSite.id)}
            disabled={sites.planningId === focusedSite.id}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sites.planningId === focusedSite.id ? t('generating') : t('nginxOpenrestyPlan')}
          </button>
          <button
            type="button"
            onClick={() => sites.handleTlsProbePlan(focusedSite)}
            disabled={sites.probingTlsId === focusedSite.id}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sites.probingTlsId === focusedSite.id ? t('generating') : t('tlsProbePlan')}
          </button>
          <button
            type="button"
            onClick={() => sites.handleOpenRestyStatus(focusedSite)}
            disabled={sites.probingRuntimeId === focusedSite.id}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sites.probingRuntimeId === focusedSite.id
              ? sites.queueSiteRuns
                ? t('statusEnqueuing')
                : t('probing')
              : sites.queueSiteRuns
                ? t('runtimeEnqueue')
                : t('runtimeProbe')}
          </button>
          <button
            type="button"
            onClick={() => sites.handleOpenRestyModules(focusedSite)}
            disabled={sites.probingModulesId === focusedSite.id}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sites.probingModulesId === focusedSite.id
              ? sites.queueSiteRuns
                ? t('modulesEnqueuing')
                : t('inventorying')
              : sites.queueSiteRuns
                ? t('modulesEnqueue')
                : t('moduleInventory')}
          </button>
          <button
            type="button"
            onClick={() => sites.handleOpenRestyModuleBaseline(focusedSite)}
            disabled={sites.checkingModuleBaselineId === focusedSite.id}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sites.checkingModuleBaselineId === focusedSite.id
              ? sites.queueSiteRuns
                ? t('baselineEnqueuing')
                : t('checking')
              : sites.queueSiteRuns
                ? t('baselineEnqueue')
                : t('baselineCheck')}
          </button>
          <button
            type="button"
            onClick={() => sites.handleSmokeCheck(focusedSite)}
            disabled={sites.smokingId === focusedSite.id}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sites.smokingId === focusedSite.id
              ? sites.queueSiteRuns
                ? t('checkEnqueuing')
                : t('checking')
              : sites.queueSiteRuns
                ? t('smokeEnqueue')
                : t('smokeCheck')}
          </button>
          <button
            type="button"
            onClick={() => sites.setFocusedSiteId('')}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent"
          >
            {t('collapse')}
          </button>
        </div>
      </div>
      {focusedTakeoverForm ? (
        <TakeoverBindingForm
          siteName={focusedSite.name}
          primaryDomain={focusedSite.primaryDomain}
          isPreviewPlaceholder={focusedIsPreviewPlaceholder}
          form={focusedTakeoverForm}
          servers={sites.servers}
          tlsAssets={focusedTlsAssets}
          savingTakeover={sites.savingTakeoverId === focusedSite.id}
          activatingPreview={sites.activatingPreviewId === focusedSite.id}
          queueSiteRuns={sites.queueSiteRuns}
          onUpdate={updateFocusedTakeoverForm}
          onSave={() => handleSaveTakeoverBinding(focusedSite)}
          onActivatePreview={() => handleActivatePreviewSite(focusedSite)}
        />
      ) : null}
      <FocusedSitePlanRunSummary
        plan={focusedPlan}
        recentRuns={focusedRecentRuns}
      />
    </section>
  );
}
