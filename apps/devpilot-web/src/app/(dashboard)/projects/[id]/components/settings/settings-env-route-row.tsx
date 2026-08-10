import React from 'react';
import { useTranslations } from 'next-intl';
import {
  buildRouteProbeEvidenceHref,
  type RouteEntryView,
  type RouteProbeState,
} from './settings-env-routes.model';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function SettingsEnvRouteRow({
  row,
  projectId,
  t,
  onEdit,
  onDelete,
}: {
  row: RouteEntryView;
  projectId: string;
  t: ProjectsTranslator;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const targetLabel = row.entry.component && row.entry.port
    ? `${row.entry.component} : ${row.entry.port}`
    : row.entry.component || t('envRoutesTargetUnspecified');
  const tlsLabel = evidenceLabel(t, row.tls.labelKey, row.tls.detail);
  const dnsLabel = evidenceLabel(t, row.dns.labelKey, row.dns.detail);
  const probeLabel = `${t(row.probe.labelKey)}${row.probe.detail ? ` ${row.probe.detail}` : ''}${
    row.probe.checkedAt ? ` · ${t('envRoutesProbeAt', { at: formatTime(row.probe.checkedAt) })}` : ''
  }`;
  return (
    <>
      <tr data-route-entry={row.entry.domain}>
        <td className="px-3 py-2"><span className="font-medium">{row.entry.domain}</span></td>
        <td className="px-3 py-2 font-mono text-xs">{row.entry.path}</td>
        <td className="px-3 py-2 font-mono text-xs">{targetLabel}</td>
        <td className="px-3 py-2 text-xs">
          <ProbeStatusLabel state={row.tls.state} label={tlsLabel} />
          <span className="ml-1.5 text-[10px] text-muted-foreground">
            {t(row.tlsMode === 'existing_cert_asset' ? 'envRoutesTlsExisting' : 'envRoutesTlsManaged')}
          </span>
        </td>
        <td className="px-3 py-2 text-xs"><ProbeStatusLabel state={row.dns.state} label={dnsLabel} /></td>
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
        <td className="px-3 py-2 text-xs">
          <div className="flex items-center gap-1">
            <button type="button" onClick={onEdit} aria-label={`${t('envRoutesEditEntry')} ${row.entry.domain} ${row.entry.path}`} className="min-h-11 rounded-md px-3 text-primary hover:bg-accent">
              {t('envRoutesEditEntry')}
            </button>
            <button type="button" onClick={onDelete} aria-label={`${t('envRoutesDeleteEntry')} ${row.entry.domain} ${row.entry.path}`} className="min-h-11 rounded-md px-3 text-red-600 hover:bg-red-50">
              {t('envRoutesDeleteEntry')}
            </button>
          </div>
        </td>
      </tr>
      <tr className="border-none">
        <td colSpan={7} className="px-3 pb-2 pt-0 text-[11px] text-muted-foreground" data-route-readiness={row.entry.domain}>
          {t('envRoutesReadinessLabel')}{' '}
          <GateChip t={t} code="D14" gate={row.readiness.d14} />{' '}
          <GateChip t={t} code="D15" gate={row.readiness.d15} />{' '}
          <GateChip t={t} code="D16" gate={row.readiness.d16} />
        </td>
      </tr>
    </>
  );
}

function GateChip({ t, code, gate }: {
  t: ProjectsTranslator;
  code: string;
  gate: RouteEntryView['readiness'][keyof RouteEntryView['readiness']];
}) {
  const tone = gate.state === 'ready'
    ? 'text-green-700'
    : gate.state === 'blocked' ? 'text-red-600' : 'text-muted-foreground';
  const label = gate.detailKey ? `${t(gate.labelKey)} · ${t(gate.detailKey)}` : t(gate.labelKey);
  return <span className={`inline-flex items-center gap-1 ${tone}`}><span className="font-mono">{code}</span><span>{label}</span></span>;
}

function ProbeStatusLabel({ state, label }: { state: RouteProbeState; label: string }) {
  const tone = state === 'ready'
    ? 'text-green-700'
    : state === 'blocked' ? 'text-red-600' : 'text-muted-foreground';
  return <span className={tone}>{label}</span>;
}

function evidenceLabel(t: ProjectsTranslator, key: string, detail?: string) {
  return `${t(key)}${detail ? ` · ${t('envRoutesProbeAt', { at: formatTime(detail) })}` : ''}`;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
