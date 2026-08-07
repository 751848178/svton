/**
 * 环境配置子区：域名与入口
 *
 * 单一职责：维护当前修订草稿的 Host/Path/TLS/DNS 路由快照，展示该环境绑定的站点；
 * 域名与证书资产生命周期跳 /sites。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import { SubtabShell } from './settings-subtab-shell';
import type { SettingsRouteDraft } from './settings-env.model';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvRoutesTab({
  environment,
  detail,
  route,
  onRouteChange,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  route: SettingsRouteDraft;
  onRouteChange: (next: SettingsRouteDraft) => void;
}) {
  const t = useTranslations('projects');
  const project = detail.project;
  const projectId = project?.id ?? '';
  const boundSites = (project?.sites ?? []).filter((site) => site.environment?.id === environment.id);

  return (
    <SubtabShell
      title={t('envTabRoutes')}
      helper={t('envTabHelperRoutes')}
      moduleHref={`/sites?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(environment.id)}`}
      moduleLabel={t('envModuleLinkSites')}
    >
      <div className="space-y-3">
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-xs font-medium">{t('configRouteSnapshot')}</div>
          <textarea
            className="min-h-16 w-full rounded-md border bg-background px-2 py-1 text-xs"
            value={route.domains}
            onChange={(event) => onRouteChange({ ...route, domains: event.target.value })}
            placeholder={t('configDomainsPlaceholder')}
            aria-label={t('configDomains')}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-md border bg-background px-2 py-1 text-xs"
              value={route.dnsProvider}
              onChange={(event) => onRouteChange({ ...route, dnsProvider: event.target.value })}
              placeholder={t('configDnsProvider')}
            />
            <input
              className="rounded-md border bg-background px-2 py-1 text-xs"
              value={route.proxyTarget}
              onChange={(event) => onRouteChange({ ...route, proxyTarget: event.target.value })}
              placeholder={t('configProxyTarget')}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={route.tlsRequired}
              onChange={(event) => onRouteChange({ ...route, tlsRequired: event.target.checked })}
            />
            {t('configTlsRequired')}
          </label>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium">{t('envRoutesBoundSites')}</div>
          {boundSites.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('envRoutesNoSites')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {boundSites.map((site) => (
                <li key={site.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{site.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {site.primaryDomain}
                    </span>
                  </span>
                  <StatusTag status={site.status} label={site.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SubtabShell>
  );
}
