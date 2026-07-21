/** 聚焦站点接管面板 - 展示聚焦站点的接管绑定/探测/计划/运行记录。 */
'use client';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { ActionMenu } from '@/components/ui/action-menu';
import type { useSites } from '../hooks/use-sites';
import { buildSiteActionGroups } from '../utils-actions';
import { runtimeTypeLabels } from '../constants';
import { readRecord, readString, readRecordArray, readBoolean } from '../utils';
import { createSiteTakeoverForm, isPreviewSitePlaceholder } from '../utils-takeover';
import {
  describeRuntime,
  getStatusLabel,
  formatTlsCertificateSummary,
} from '../utils-format';
import { FocusedSitePlanRunSummary } from './focused-site-plan-run-summary.component';
import { TakeoverBindingForm } from './takeover-binding-form';
type SitesHook = ReturnType<typeof useSites>;
export function FocusedSitePanel({ sites }: { sites: SitesHook }) {
  const t = useTranslations('sites');
  const tc = useTranslations('common');
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
  // 与站点卡共用同一份 action 定义（单一数据源）；面板不暴露删除，另保留 TLS 探测计划入口。
  const focusedCanRenewTls =
    readBoolean(focusedTls.enabled) && readString(focusedTls.type) === 'letsencrypt';
  const actions = buildSiteActionGroups({
    t,
    tc,
    site: focusedSite,
    sites,
    canRenewTls: focusedCanRenewTls,
    includeDelete: false,
  });
  return (
    <section className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{t('takeoverSiteTitle', { name: focusedSite.name })}</h2>
            <StatusTag
              status={focusedSite.status}
              label={getStatusLabel(focusedSite.status)}
            />
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
            onClick={actions.primary.onSelect}
            disabled={actions.primary.disabled}
            className="rounded-md border bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actions.primary.label}
          </button>
          <button
            type="button"
            onClick={actions.secondary.onSelect}
            disabled={actions.secondary.disabled}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actions.secondary.label}
          </button>
          <button
            type="button"
            onClick={() => sites.handleTlsProbePlan(focusedSite)}
            disabled={sites.probingTlsId === focusedSite.id}
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sites.probingTlsId === focusedSite.id ? t('generating') : t('tlsProbePlan')}
          </button>
          <ActionMenu groups={actions.menuGroups} triggerLabel={t('moreActions')} />
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
