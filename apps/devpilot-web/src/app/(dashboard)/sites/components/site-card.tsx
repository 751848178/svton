/** 站点卡片 - 单个站点的状态/操作/计划/运行记录。 */
'use client';
import type { Site } from '../types';
import type { useSites } from '../hooks/use-sites';
import { readRecord, readStringArray, readBoolean, readString } from '../utils';
import { runtimeTypeLabels } from '../constants';
import { SitePlanRunPanel } from './site-plan-run-panel';
import { SiteCardActions } from './site-card-actions.component';
import {
  describeRuntime,
  getStatusLabel,
  getStatusClass,
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
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(site.status)}`}
            >
              {getStatusLabel(site.status)}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {runtimeTypeLabels[site.runtimeType] || site.runtimeType}
            </span>
            {hasTls && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                TLS
              </span>
            )}
          </div>
          <div className="font-mono text-sm">{site.primaryDomain}</div>
          {aliases.length > 0 && (
            <div className="text-xs text-muted-foreground">别名：{aliases.join(', ')}</div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>项目：{site.project?.name || '未关联'}</span>
            <span>环境：{site.environment?.name || '未绑定'}</span>
            <span>
              服务器：{site.server ? `${site.server.name} (${site.server.host})` : '未关联'}
            </span>
            <span>上游：{describeRuntime(site.runtimeType, runtimeConfig)}</span>
          </div>
          {tlsSummary && <div className="text-xs text-muted-foreground">证书：{tlsSummary}</div>}
          {tlsRenewalSummary && (
            <div className="text-xs text-muted-foreground">续期：{tlsRenewalSummary}</div>
          )}
          {site.proxyConfig && (
            <div className="text-xs text-muted-foreground">
              关联代理配置：{site.proxyConfig.name} · {site.proxyConfig.domain}
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
