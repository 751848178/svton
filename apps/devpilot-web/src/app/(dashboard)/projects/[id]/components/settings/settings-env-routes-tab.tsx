/**
 * 环境配置子区：域名与入口（Demo 对齐，AC-SET-042..050）
 *
 * 单一职责：以 Demo 六列表（域名/Path/目标组件/TLS/DNS/外部探测）展示当前
 * 修订草稿的每条结构化入口，联接真实 Site 探测数据（Site.dns/Site.tls/
 * routeSwitch/lastSyncAt，F438）与最新生产 DeploymentRun 的 siteProbe 证据
 * （F437/F439/F440）；每行按 D14/D15/D16 门禁证据（AC-SET-048）给出就绪
 * 状态与阻断原因；「添加入口」弹窗（AC-SET-043）写回草稿 entries，
 * 保存经修订化 CAS 完成（AC-SET-046）；探测证据可下钻到部署记录
 * （AC-SET-049）；域名与证书资产生命周期跳 /sites。
 */
'use client';

import React, { useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import type { DeploymentRun } from '../../types/operations';
import { SettingsEnvEntryModal } from './settings-env-entry-modal';
import {
  buildRouteEntryViews,
  buildRouteProbeEvidenceHref,
  type RouteEntryView,
  type RouteProbeState,
} from './settings-env-routes.model';
import { SubtabShell } from './settings-subtab-shell';
import type { SettingsRouteDraft } from './settings-env.model';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvRoutesTab({
  environment,
  detail,
  route,
  onRouteChange,
  revision,
  deploymentRuns,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  route: SettingsRouteDraft;
  onRouteChange: (next: SettingsRouteDraft) => void;
  revision?: EnvironmentConfigRevision | null;
  deploymentRuns?: DeploymentRun[];
}) {
  const t = useTranslations('projects');
  const project = detail.project;
  const projectId = project?.id ?? '';
  const [modalOpen, setModalOpen] = useState(false);
  const boundSites = (project?.sites ?? []).filter((site) => site.environment?.id === environment.id);
  const rows = useMemo(
    () =>
      buildRouteEntryViews({
        entries: route.entries,
        sites: boundSites,
        deploymentRuns: deploymentRuns ?? [],
      }),
    // boundSites is derived from project.sites on each render; entries/runs drive the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route.entries, deploymentRuns, environment.id, project?.sites],
  );

  return (
    <SubtabShell
      title={t('envTabRoutes')}
      helper={t('envTabHelperRoutes')}
      moduleHref={`/sites?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(environment.id)}`}
      moduleLabel={t('envModuleLinkSites')}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">{t('envRoutesTitle')}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('envRoutesHelper')}</p>
          </div>
          <div className="flex items-center gap-2">
            {revision ? (
              <span className="inline-block rounded bg-green-100 px-2 py-1 text-[10px] font-medium text-green-700">
                {t('envRoutesCurrentBadge')}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
            >
              + {t('envRoutesAddEntry')}
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('envRoutesEmpty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <caption className="sr-only">{t('envRoutesTableTitle')}</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t('envRoutesTableDomain')}</th>
                  <th className="px-3 py-2 font-medium">{t('envRoutesTablePath')}</th>
                  <th className="px-3 py-2 font-medium">{t('envRoutesTableComponent')}</th>
                  <th className="px-3 py-2 font-medium">{t('envRoutesTableTls')}</th>
                  <th className="px-3 py-2 font-medium">{t('envRoutesTableDns')}</th>
                  <th className="px-3 py-2 font-medium">{t('envRoutesTableProbe')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <RouteRow
                    key={row.key}
                    row={row}
                    projectId={projectId}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-2">
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t('envRoutesCalloutOwnership')}
          </p>
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t('envRoutesCalloutFrozen')}
          </p>
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

        <SettingsEnvEntryModal
          open={modalOpen}
          environmentName={environment.name}
          onClose={() => setModalOpen(false)}
          onConfirm={(entry) =>
            onRouteChange({
              ...route,
              entries: [...route.entries.filter((item) => item.domain !== entry.domain), entry],
            })
          }
        />
      </div>
    </SubtabShell>
  );
}

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

function RouteRow({
  row,
  projectId,
  t,
}: {
  row: RouteEntryView;
  projectId: string;
  t: ProjectsTranslator;
}) {
  const targetLabel =
    row.entry.component && row.entry.port
      ? `${row.entry.component} : ${row.entry.port}`
      : row.entry.component
        ? row.entry.component
        : t('envRoutesTargetUnspecified');
  const tlsLabel = `${t(row.tls.labelKey)}${row.tls.detail ? ` · ${t('envRoutesProbeAt', { at: formatTime(row.tls.detail) })}` : ''}`;
  const dnsLabel = `${t(row.dns.labelKey)}${row.dns.detail ? ` · ${t('envRoutesProbeAt', { at: formatTime(row.dns.detail) })}` : ''}`;
  const probeLabel = `${t(row.probe.labelKey)}${row.probe.detail ? ` ${row.probe.detail}` : ''}${row.probe.checkedAt ? ` · ${t('envRoutesProbeAt', { at: formatTime(row.probe.checkedAt) })}` : ''}`;
  return (
    <>
      <tr data-route-entry={row.entry.domain}>
        <td className="px-3 py-2">
          <span className="font-medium">{row.entry.domain}</span>
        </td>
        <td className="px-3 py-2 font-mono text-xs">{row.entry.path}</td>
        <td className="px-3 py-2 font-mono text-xs">{targetLabel}</td>
        <td className="px-3 py-2 text-xs">
          <ProbeStatusLabel state={row.tls.state} label={tlsLabel} />
          <span className="ml-1.5 text-[10px] text-muted-foreground">
            {row.tlsMode === 'existing_cert_asset' ? t('envRoutesTlsExisting') : t('envRoutesTlsManaged')}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">
          <ProbeStatusLabel state={row.dns.state} label={dnsLabel} />
        </td>
        <td className="px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <ProbeStatusLabel state={row.probe.state} label={probeLabel} />
            {row.evidence ? (
              <a
                href={buildRouteProbeEvidenceHref(projectId, row.evidence.deploymentRunId)}
                className="text-primary hover:underline"
                data-route-evidence-link="true"
              >
                {t('envRoutesEvidenceLink')}
              </a>
            ) : null}
          </div>
        </td>
      </tr>
      <tr className="border-none">
        <td
          colSpan={6}
          className="px-3 pb-2 pt-0 text-[11px] text-muted-foreground"
          data-route-readiness={row.entry.domain}
        >
          {t('envRoutesReadinessLabel')}{' '}
          <GateChip t={t} code="D14" gate={row.readiness.d14} />{' '}
          <GateChip t={t} code="D15" gate={row.readiness.d15} />{' '}
          <GateChip t={t} code="D16" gate={row.readiness.d16} />
        </td>
      </tr>
    </>
  );
}

function GateChip({
  t,
  code,
  gate,
}: {
  t: ProjectsTranslator;
  code: string;
  gate: RouteEntryView['readiness'][keyof RouteEntryView['readiness']];
}) {
  const tone = gate.state === 'ready' ? 'text-green-700' : gate.state === 'blocked' ? 'text-red-600' : 'text-muted-foreground';
  const label = gate.detailKey ? `${t(gate.labelKey)} · ${t(gate.detailKey)}` : t(gate.labelKey);
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      <span className="font-mono">{code}</span>
      <span>{label}</span>
    </span>
  );
}

function ProbeStatusLabel({ state, label }: { state: RouteProbeState; label: string }) {
  const tone =
    state === 'ready'
      ? 'text-green-700'
      : state === 'blocked'
        ? 'text-red-600'
        : 'text-muted-foreground';
  return <span className={tone}>{label}</span>;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
