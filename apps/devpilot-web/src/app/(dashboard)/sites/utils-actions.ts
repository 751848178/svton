/**
 * 站点操作分组构造（站点卡 / 聚焦面板共用，单一数据源）。
 *
 * L1 主操作：同步计划；L2 次操作：请求同步；
 * L3 菜单分组：同步（冒烟）、证书（探测/演练/续期）、诊断（诊断/OpenResty 状态/模块/模块基线）；
 * L4 危险组：删除（仅站点卡，触发既有 ConfirmDialog 流程）。
 * 文案随 queueSiteRuns 开关变化，与原平铺按钮逻辑一致。
 */

import type { ActionMenuGroup, ActionMenuItem } from '@/components/ui/action-menu';
import type { useSites } from './hooks/use-sites';
import type { Site } from './types';

type SitesHook = ReturnType<typeof useSites>;
type Translate = (key: string) => string;

export interface SiteActionButton {
  key: string;
  label: string;
  disabled: boolean;
  onSelect: () => void;
}

export interface SiteActionGroups {
  /** L1 主操作：同步计划 */
  primary: SiteActionButton;
  /** L2 次操作：请求同步 */
  secondary: SiteActionButton;
  /** L3 分组菜单 + L4 危险组（includeDelete 时） */
  menuGroups: ActionMenuGroup[];
}

export function buildSiteActionGroups(args: {
  t: Translate;
  tc: Translate;
  site: Site;
  sites: SitesHook;
  canRenewTls: boolean;
  includeDelete?: boolean;
}): SiteActionGroups {
  const { t, tc, site, sites, canRenewTls, includeDelete = false } = args;
  const queued = sites.queueSiteRuns;

  const primary: SiteActionButton = {
    key: 'sync-plan',
    label:
      sites.planningId === site.id
        ? queued
          ? t('enqueuing')
          : t('generating')
        : queued
          ? t('planEnqueue')
          : t('syncPlan'),
    disabled: sites.planningId === site.id,
    onSelect: () => sites.handleCreatePlan(site.id),
  };

  const secondary: SiteActionButton = {
    key: 'request-sync',
    label:
      sites.syncingId === site.id
        ? queued
          ? t('requestEnqueuing')
          : t('requesting')
        : queued
          ? t('requestSyncEnqueue')
          : t('requestSync'),
    disabled: sites.syncingId === site.id,
    onSelect: () => sites.handleSyncLive(site),
  };

  const syncItems: ActionMenuItem[] = [
    {
      key: 'smoke-check',
      label:
        sites.smokingId === site.id
          ? queued
            ? t('checkEnqueuing')
            : t('checking')
          : queued
            ? t('smokeEnqueue')
            : t('smokeCheck'),
      disabled: sites.smokingId === site.id,
      onSelect: () => sites.handleSmokeCheck(site),
    },
  ];

  const certItems: ActionMenuItem[] = [
    {
      key: 'tls-probe',
      label:
        sites.probingTlsId === site.id
          ? queued
            ? t('probeEnqueuing')
            : t('probing')
          : queued
            ? t('certProbeEnqueue')
            : t('certProbe'),
      disabled: sites.probingTlsId === site.id,
      onSelect: () => sites.handleTlsProbe(site),
    },
  ];
  if (canRenewTls) {
    certItems.push(
      {
        key: 'tls-renew-drill',
        label:
          sites.renewingTlsId === site.id
            ? queued
              ? t('drillEnqueuing')
              : t('drilling')
            : queued
              ? t('renewDrillEnqueue')
              : t('renewDrill'),
        disabled: sites.renewingTlsId === site.id,
        onSelect: () => sites.handleTlsRenew(site, true),
      },
      {
        key: 'tls-renew-request',
        label:
          sites.renewingTlsId === site.id
            ? queued
              ? t('requestEnqueuing')
              : t('requesting')
            : queued
              ? t('requestRenewEnqueue')
              : t('requestRenew'),
        disabled: sites.renewingTlsId === site.id,
        onSelect: () => sites.handleTlsRenew(site, false),
      },
    );
  }

  const diagnosticsItems: ActionMenuItem[] = [
    {
      key: 'diagnostics',
      label:
        sites.diagnosingId === site.id
          ? queued
            ? t('diagEnqueuing')
            : t('diagnosing')
          : queued
            ? t('diagEnqueue')
            : t('diagnose'),
      disabled: sites.diagnosingId === site.id,
      onSelect: () => sites.handleDiagnostics(site),
    },
    {
      key: 'openresty-status',
      label:
        sites.probingRuntimeId === site.id
          ? queued
            ? t('statusEnqueuing')
            : t('probing')
          : queued
            ? t('statusEnqueue')
            : t('openrestyStatus'),
      disabled: sites.probingRuntimeId === site.id,
      onSelect: () => sites.handleOpenRestyStatus(site),
    },
    {
      key: 'openresty-modules',
      label:
        sites.probingModulesId === site.id
          ? queued
            ? t('modulesEnqueuing')
            : t('inventorying')
          : queued
            ? t('modulesEnqueue')
            : t('openrestyModules'),
      disabled: sites.probingModulesId === site.id,
      onSelect: () => sites.handleOpenRestyModules(site),
    },
    {
      key: 'openresty-module-baseline',
      label:
        sites.checkingModuleBaselineId === site.id
          ? queued
            ? t('baselineEnqueuing')
            : t('checking')
          : queued
            ? t('baselineEnqueue')
            : t('moduleBaseline'),
      disabled: sites.checkingModuleBaselineId === site.id,
      onSelect: () => sites.handleOpenRestyModuleBaseline(site),
    },
  ];

  const menuGroups: ActionMenuGroup[] = [
    { label: t('groupSync'), items: syncItems },
    { label: t('groupCert'), items: certItems },
    { label: t('groupDiagnostics'), items: diagnosticsItems },
  ];

  if (includeDelete) {
    menuGroups.push({
      items: [
        {
          key: 'delete',
          label: tc('delete'),
          danger: true,
          onSelect: () => sites.handleDelete(site.id),
        },
      ],
    });
  }

  return { primary, secondary, menuGroups };
}
