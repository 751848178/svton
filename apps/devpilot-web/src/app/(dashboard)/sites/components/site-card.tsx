/** 站点卡片 - 单个站点的状态/操作/计划/运行记录。 */
'use client';
import Link from 'next/link';
import { usePersistFn } from '@svton/hooks';
import type { Site } from '../types';
import type { useSites } from '../hooks/use-sites';
import { readRecord, readStringArray, readBoolean, readString } from '../utils';
import { runtimeTypeLabels } from '../constants';
import { SitePlanRunPanel } from './site-plan-run-panel';
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => sites.handleCreatePlan(site.id)}
            disabled={sites.planningId === site.id}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {sites.planningId === site.id
              ? sites.queueSiteRuns
                ? '入队中...'
                : '生成中...'
              : sites.queueSiteRuns
                ? '计划入队'
                : '同步计划'}
          </button>
          <button
            onClick={() => sites.handleSyncLive(site)}
            disabled={sites.syncingId === site.id}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {sites.syncingId === site.id
              ? sites.queueSiteRuns
                ? '申请入队中...'
                : '申请中...'
              : sites.queueSiteRuns
                ? '申请同步入队'
                : '申请同步'}
          </button>
          <button
            onClick={() => sites.handleDiagnostics(site)}
            disabled={sites.diagnosingId === site.id}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {sites.diagnosingId === site.id
              ? sites.queueSiteRuns
                ? '诊断入队中...'
                : '诊断中...'
              : sites.queueSiteRuns
                ? '诊断入队'
                : '诊断'}
          </button>
          <button
            onClick={() => sites.handleOpenRestyStatus(site)}
            disabled={sites.probingRuntimeId === site.id}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {sites.probingRuntimeId === site.id
              ? sites.queueSiteRuns
                ? '状态入队中...'
                : '探测中...'
              : sites.queueSiteRuns
                ? '状态入队'
                : 'OpenResty 状态'}
          </button>
          <button
            onClick={() => sites.handleOpenRestyModules(site)}
            disabled={sites.probingModulesId === site.id}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {sites.probingModulesId === site.id
              ? sites.queueSiteRuns
                ? '模块入队中...'
                : '盘点中...'
              : sites.queueSiteRuns
                ? '模块入队'
                : 'OpenResty 模块'}
          </button>
          <button
            onClick={() => sites.handleOpenRestyModuleBaseline(site)}
            disabled={sites.checkingModuleBaselineId === site.id}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {sites.checkingModuleBaselineId === site.id
              ? sites.queueSiteRuns
                ? '基线入队中...'
                : '检查中...'
              : sites.queueSiteRuns
                ? '基线入队'
                : '模块基线'}
          </button>
          <button
            onClick={() => sites.handleSmokeCheck(site)}
            disabled={sites.smokingId === site.id}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {sites.smokingId === site.id
              ? sites.queueSiteRuns
                ? '检查入队中...'
                : '检查中...'
              : sites.queueSiteRuns
                ? 'Smoke 入队'
                : 'Smoke 检查'}
          </button>
          <button
            onClick={() => sites.handleTlsProbe(site)}
            disabled={sites.probingTlsId === site.id}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {sites.probingTlsId === site.id
              ? sites.queueSiteRuns
                ? '探测入队中...'
                : '探测中...'
              : sites.queueSiteRuns
                ? '证书探测入队'
                : '证书探测'}
          </button>
          {canRenewTls && (
            <>
              <button
                onClick={() => sites.handleTlsRenew(site, true)}
                disabled={sites.renewingTlsId === site.id}
                className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {sites.renewingTlsId === site.id
                  ? sites.queueSiteRuns
                    ? '演练入队中...'
                    : '演练中...'
                  : sites.queueSiteRuns
                    ? '续期演练入队'
                    : '续期演练'}
              </button>
              <button
                onClick={() => sites.handleTlsRenew(site, false)}
                disabled={sites.renewingTlsId === site.id}
                className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {sites.renewingTlsId === site.id
                  ? sites.queueSiteRuns
                    ? '申请入队中...'
                    : '申请中...'
                  : sites.queueSiteRuns
                    ? '申请续期入队'
                    : '申请续期'}
              </button>
            </>
          )}
          <button
            onClick={() => sites.handleDelete(site.id)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            删除
          </button>
        </div>
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
