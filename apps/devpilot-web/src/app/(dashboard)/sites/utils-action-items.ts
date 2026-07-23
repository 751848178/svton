/**
 * 站点操作菜单的分组项构造（同步 / 证书 / 诊断）。
 *
 * 单一职责：把「动作 → ActionMenuItem」的 label/disabled/onSelect 装配抽离出来，
 * 让 utils-actions.ts 的 buildSiteActionGroups 只负责编排主/次操作与分组顺序。
 * 文案随 queueSiteRuns 开关变化。
 */

import type { ActionMenuItem } from '@/components/ui/action-menu';
import type { useSites } from './hooks/use-sites';
import type { Site } from './types';

type SitesHook = ReturnType<typeof useSites>;
type Translate = (key: string) => string;

interface BuildItemsArgs {
  t: Translate;
  site: Site;
  sites: SitesHook;
  queued: boolean;
  canRenewTls: boolean;
  includeTlsProbePlan: boolean;
}

/** 同步分组：冒烟检查。 */
export function buildSyncItems(args: BuildItemsArgs): ActionMenuItem[] {
  const { t, site, sites, queued } = args;
  return [
    {
      key: 'smoke-check',
      label: sites.smokingId === site.id
        ? queued ? t('checkEnqueuing') : t('checking')
        : queued ? t('smokeEnqueue') : t('smokeCheck'),
      disabled: sites.smokingId === site.id,
      onSelect: () => sites.handleSmokeCheck(site),
    },
  ];
}

/** 证书分组：TLS 探测（+ 可选续期演练/续期/TLS 探测计划）。 */
export function buildCertItems(args: BuildItemsArgs): ActionMenuItem[] {
  const { t, site, sites, queued, canRenewTls, includeTlsProbePlan } = args;
  const items: ActionMenuItem[] = [
    {
      key: 'tls-probe',
      label: sites.probingTlsId === site.id
        ? queued ? t('probeEnqueuing') : t('probing')
        : queued ? t('certProbeEnqueue') : t('certProbe'),
      disabled: sites.probingTlsId === site.id,
      onSelect: () => sites.handleTlsProbe(site),
    },
  ];
  if (canRenewTls) {
    items.push(
      {
        key: 'tls-renew-drill',
        label: sites.renewingTlsId === site.id
          ? queued ? t('drillEnqueuing') : t('drilling')
          : queued ? t('renewDrillEnqueue') : t('renewDrill'),
        disabled: sites.renewingTlsId === site.id,
        onSelect: () => sites.handleTlsRenew(site, true),
      },
      {
        key: 'tls-renew-request',
        label: sites.renewingTlsId === site.id
          ? queued ? t('requestEnqueuing') : t('requesting')
          : queued ? t('requestRenewEnqueue') : t('requestRenew'),
        disabled: sites.renewingTlsId === site.id,
        onSelect: () => sites.handleTlsRenew(site, false),
      },
    );
  }
  if (includeTlsProbePlan) {
    items.push({
      key: 'tls-probe-plan',
      label: sites.probingTlsId === site.id ? t('generating') : t('tlsProbePlan'),
      disabled: sites.probingTlsId === site.id,
      onSelect: () => sites.handleTlsProbePlan(site),
    });
  }
  return items;
}

/** 诊断分组：诊断 / OpenResty 状态 / 模块 / 模块基线。 */
export function buildDiagnosticsItems(args: BuildItemsArgs): ActionMenuItem[] {
  const { t, site, sites, queued } = args;
  return [
    {
      key: 'diagnostics',
      label: sites.diagnosingId === site.id
        ? queued ? t('diagEnqueuing') : t('diagnosing')
        : queued ? t('diagEnqueue') : t('diagnose'),
      disabled: sites.diagnosingId === site.id,
      onSelect: () => sites.handleDiagnostics(site),
    },
    {
      key: 'openresty-status',
      label: sites.probingRuntimeId === site.id
        ? queued ? t('statusEnqueuing') : t('probing')
        : queued ? t('statusEnqueue') : t('openrestyStatus'),
      disabled: sites.probingRuntimeId === site.id,
      onSelect: () => sites.handleOpenRestyStatus(site),
    },
    {
      key: 'openresty-modules',
      label: sites.probingModulesId === site.id
        ? queued ? t('modulesEnqueuing') : t('inventorying')
        : queued ? t('modulesEnqueue') : t('openrestyModules'),
      disabled: sites.probingModulesId === site.id,
      onSelect: () => sites.handleOpenRestyModules(site),
    },
    {
      key: 'openresty-module-baseline',
      label: sites.checkingModuleBaselineId === site.id
        ? queued ? t('baselineEnqueuing') : t('checking')
        : queued ? t('baselineEnqueue') : t('moduleBaseline'),
      disabled: sites.checkingModuleBaselineId === site.id,
      onSelect: () => sites.handleOpenRestyModuleBaseline(site),
    },
  ];
}
