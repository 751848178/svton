/**
 * 站点操作分组构造（站点卡 / 聚焦面板共用，单一数据源）。
 *
 * L1 主操作：同步计划；L2 次操作：请求同步；
 * L3 菜单分组：同步（冒烟）、证书（探测/演练/续期）、诊断（诊断/OpenResty 状态/模块/模块基线）；
 * L4 危险组：删除（仅站点卡，触发既有 ConfirmDialog 流程）。
 * 分组项的装配见 utils-action-items.ts。
 * 文案随 queueSiteRuns 开关变化，与原平铺按钮逻辑一致。
 */

import type { ActionMenuGroup, ActionMenuItem } from '@/components/ui/action-menu';
import type { useSites } from './hooks/use-sites';
import type { Site } from './types';
import { buildSyncItems, buildCertItems, buildDiagnosticsItems } from './utils-action-items';

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
  /** 是否在证书分组里追加「TLS 探测计划」入口（聚焦面板用）。 */
  includeTlsProbePlan?: boolean;
}): SiteActionGroups {
  const { t, tc, site, sites, canRenewTls, includeDelete = false, includeTlsProbePlan = false } = args;
  const queued = sites.queueSiteRuns;
  const itemsArgs = { t, site, sites, queued, canRenewTls, includeTlsProbePlan };

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

  const menuGroups: ActionMenuGroup[] = [
    { label: t('groupSync'), items: buildSyncItems(itemsArgs) },
    { label: t('groupCert'), items: buildCertItems(itemsArgs) },
    { label: t('groupDiagnostics'), items: buildDiagnosticsItems(itemsArgs) },
  ];

  if (includeDelete) {
    menuGroups.push(buildDeleteGroup(tc, site, sites));
  }

  return { primary, secondary, menuGroups };
}

/** L4 危险组：删除（仅站点卡）。 */
function buildDeleteGroup(
  tc: Translate,
  site: Site,
  sites: SitesHook,
): ActionMenuGroup {
  return {
    items: [
      {
        key: 'delete',
        label: tc('delete'),
        danger: true,
        onSelect: () => sites.handleDelete(site.id),
      },
    ],
  };
}
