/** 站点卡片 - 单个站点的状态/操作/计划/运行记录。 */
'use client';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { Site } from '../types';
import type { useSites } from '../hooks/use-sites';
import { readRecord, readStringArray, readBoolean, readString } from '../utils';
import { runtimeTypeLabels } from '../constants';
import { SitePlanRunPanel } from './site-plan-run-panel';
import { SiteCardActions } from './site-card-actions.component';
import {
  describeRuntime,
  getStatusLabel,
  getRunModeLabel,
  formatRunLogPreview,
  readLogMessages,
  formatDateTime,
  formatTlsCertificateSummary,
  formatTlsRenewalSummary,
  getTlsRenewalStatusLabel,
  getTlsFollowUpProbeStatusLabel,
} from '../utils-format';
type SitesHook = ReturnType<typeof useSites>;
export function SiteCard({ site, sites }: { site: Site; sites: SitesHook }) {
  const t = useTranslations('sites');
  const plan = sites.plans[site.id];
  const recentRuns = sites.syncRuns[site.id] || [];
  const runtimeConfig = readRecord(site.runtimeConfig);
  const tls = readRecord(site.tls);
  const aliases = readStringArray(site.aliases);
  const tlsSummary = formatTlsCertificateSummary(tls);
  const tlsRenewalSummary = formatTlsRenewalSummary(tls);
  const hasTls = readBoolean(tls.enabled) || Boolean(tlsSummary);
  const canRenewTls = readBoolean(tls.enabled) && readString(tls.type) === 'letsencrypt';
  const isFocused = sites.focusedSiteId === site.id;
  return (
    <div
      key={site.id}
      className={`rounded-lg border p-4 ${isFocused ? 'border-primary/50 bg-primary/5 shadow-sm' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{site.name}</h2>
            <StatusTag
              status={site.status}
              label={getStatusLabel(site.status)}
            />
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {runtimeTypeLabels[site.runtimeType] || site.runtimeType}
            </span>
            {hasTls && (
              <StatusTag
                status="active"
                label="TLS"
              />
            )}
          </div>
          <a
            href={`https://${site.primaryDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-foreground underline-offset-2 hover:underline"
          >
            {site.primaryDomain}
          </a>
          {aliases.length > 0 && (
            <div className="text-xs text-muted-foreground">{t('aliasesLabel', { aliases: aliases.join(', ') })}</div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{t('projectLabel', { name: site.project?.name || t('notLinked') })}</span>
            <span>{t('environmentLabel', { name: site.environment?.name || t('notBound') })}</span>
            <span>
              {t('serverLabel', {
                name: site.server ? `${site.server.name} (${site.server.host})` : t('notLinked'),
              })}
            </span>
            <span>{t('upstreamLabel', { name: describeRuntime(site.runtimeType, runtimeConfig) })}</span>
          </div>
          {tlsSummary && <div className="text-xs text-muted-foreground">{t('certLabel', { name: tlsSummary })}</div>}
          {tlsRenewalSummary && (
            <div className="text-xs text-muted-foreground">{t('renewalLabel', { name: tlsRenewalSummary })}</div>
          )}
          {site.proxyConfig && (
            <div className="text-xs text-muted-foreground">
              {t('proxyConfigLabel', { name: site.proxyConfig.name, domain: site.proxyConfig.domain })}
            </div>
          )}
        </div>
        <SiteCardActions
          site={site}
          sites={sites}
          canRenewTls={canRenewTls}
        />
      </div>
      <SitePlanRunPanel
        site={site}
        sites={sites}
        plan={plan}
        recentRuns={recentRuns}
      />
    </div>
  );
}
