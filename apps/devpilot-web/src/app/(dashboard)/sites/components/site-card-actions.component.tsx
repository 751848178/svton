/** Site card action buttons. */

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
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => sites.handleCreatePlan(site.id)}
        disabled={sites.planningId === site.id}
        className={actionButtonClass}
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
        className={actionButtonClass}
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
        className={actionButtonClass}
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
        className={actionButtonClass}
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
        className={actionButtonClass}
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
        className={actionButtonClass}
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
        className={actionButtonClass}
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
        className={actionButtonClass}
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
            className={actionButtonClass}
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
            className={actionButtonClass}
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
  );
}
