import type { ProjectEnvironment, ProjectSite } from '../../types';
import type { EnvironmentConfigRevision } from '../../types/environment-config-revision.types';
import type { DeploymentRun } from '../../types/operations';
import {
  latestSiteProbeEvidence,
  type SettingsSiteProbeEvidence,
} from './settings-site-probe-evidence.model';
export type VerificationEvidenceStatus =
  | 'ready'
  | 'failed'
  | 'configured'
  | 'unavailable'
  | 'not_applicable';

export type VerificationEvidenceRow = {
  id: string;
  ruleKey: string;
  target: string;
  configuration: string | null;
  status: VerificationEvidenceStatus;
  resultKey: string;
  resultDetail: string | null;
  checkedAt: string | null;
  source: 'configuration' | 'site' | 'deployment' | 'none';
  deploymentRunId: string | null;
};
type ObservabilitySnapshot = EnvironmentConfigRevision['observabilitySnapshot'];
export function buildVerificationEvidenceRows(params: {
  environment: ProjectEnvironment;
  snapshot?: ObservabilitySnapshot;
  sites: ProjectSite[];
  deploymentRuns: DeploymentRun[];
}): VerificationEvidenceRow[] {
  const target = `${params.environment.name} (${params.environment.key})`;
  const rows = configurationRows(params.snapshot, target);
  const sites = params.sites.filter((site) => site.environment?.id === params.environment.id);
  if (sites.length === 0) {
    rows.push(unavailableRow('entry', 'environmentVerificationRuleEntryProbe', target));
    return rows;
  }
  for (const site of sites) {
    const latest = latestSiteProbeEvidence(params.deploymentRuns, params.environment, site);
    rows.push(dnsRow(site, latest), tlsRow(site, latest), httpRow(site, latest));
  }
  return rows;
}
function configurationRows(snapshot: ObservabilitySnapshot, target: string) {
  const health = snapshot?.metrics
    ? configuredRow('health', 'environmentVerificationRuleHealth', target, snapshot.metrics)
    : unavailableRow('health', 'environmentVerificationRuleHealth', target);
  const destinations = [snapshot?.logs, snapshot?.traces, snapshot?.alerts].filter(
    (value): value is string => Boolean(value),
  );
  const evidence = destinations.length > 0
    ? configuredRow(
      'destinations',
      'environmentVerificationRuleEvidenceDestination',
      target,
      destinations.join(' · '),
      destinations.every((value) => value.startsWith('not-applicable-')),
    )
    : unavailableRow('destinations', 'environmentVerificationRuleEvidenceDestination', target);
  return [health, evidence];
}
function configuredRow(
  id: string,
  ruleKey: string,
  target: string,
  configuration: string,
  notApplicable = false,
): VerificationEvidenceRow {
  return {
    id,
    ruleKey,
    target,
    configuration,
    status: notApplicable ? 'not_applicable' : 'configured',
    resultKey: notApplicable
      ? 'environmentVerificationResultNotApplicable'
      : 'environmentVerificationResultConfiguredOnly',
    resultDetail: null,
    checkedAt: null,
    source: 'configuration',
    deploymentRunId: null,
  };
}
function unavailableRow(id: string, ruleKey: string, target: string): VerificationEvidenceRow {
  return {
    id,
    ruleKey,
    target,
    configuration: null,
    status: 'unavailable',
    resultKey: 'environmentVerificationResultUnconfigured',
    resultDetail: null,
    checkedAt: null,
    source: 'none',
    deploymentRunId: null,
  };
}
type SiteProbe = SettingsSiteProbeEvidence | null;
function dnsRow(site: ProjectSite, latest: SiteProbe): VerificationEvidenceRow {
  const deployment = latest?.evidence.siteProbe?.dns;
  const siteProbe = site.dns;
  const useDeployment = Boolean(deployment?.status) && newer(deployment?.checkedAt, siteProbe?.checkedAt);
  const probe = useDeployment ? deployment : siteProbe;
  return probeRow({
    id: `dns:${site.id}`,
    ruleKey: 'environmentVerificationRuleDns',
    site,
    status: probe?.status,
    checkedAt: probe?.checkedAt,
    readyStatuses: ['passed', 'resolved'],
    detail: probe?.error?.message ?? probe?.hostname ?? null,
    latest: useDeployment ? latest : null,
    source: useDeployment ? 'deployment' : 'site',
  });
}
function tlsRow(site: ProjectSite, latest: SiteProbe): VerificationEvidenceRow {
  const deployment = latest?.evidence.siteProbe?.tls;
  const siteProbe = site.tls?.probe;
  const useDeployment = Boolean(deployment?.status) && newer(deployment?.checkedAt, siteProbe?.checkedAt);
  const probe = useDeployment ? deployment : siteProbe;
  const configured = !probe?.checkedAt && Boolean(site.tls?.enabled || site.tls?.status);
  return probeRow({
    id: `tls:${site.id}`,
    ruleKey: 'environmentVerificationRuleTls',
    site,
    status: probe?.status,
    checkedAt: probe?.checkedAt,
    readyStatuses: ['passed', 'valid'],
    detail: probe?.error?.message ?? null,
    latest: useDeployment ? latest : null,
    source: useDeployment ? 'deployment' : 'site',
    configured,
  });
}
function httpRow(site: ProjectSite, latest: SiteProbe): VerificationEvidenceRow {
  const probe = latest?.evidence.siteProbe?.http;
  return probeRow({
    id: `http:${site.id}`,
    ruleKey: 'environmentVerificationRuleHttp',
    site,
    status: probe?.status,
    checkedAt: probe?.checkedAt,
    readyStatuses: ['passed'],
    detail: probe?.error?.message ?? (probe?.statusCode ? `HTTP ${probe.statusCode}` : null),
    latest,
    source: latest ? 'deployment' : 'none',
  });
}

function probeRow(params: {
  id: string;
  ruleKey: string;
  site: ProjectSite;
  status?: string | null;
  checkedAt?: string | null;
  readyStatuses: string[];
  detail: string | null;
  latest: SiteProbe;
  source: VerificationEvidenceRow['source'];
  configured?: boolean;
}): VerificationEvidenceRow {
  const explicit = Boolean(params.checkedAt && params.status);
  const ready = explicit && params.readyStatuses.includes(params.status ?? '');
  const failed = explicit && ['failed', 'invalid', 'error', 'unresolved'].includes(params.status ?? '');
  const status = ready
    ? 'ready'
    : failed
      ? 'failed'
      : params.configured
        ? 'configured'
        : 'unavailable';
  return {
    id: params.id,
    ruleKey: params.ruleKey,
    target: params.site.primaryDomain,
    configuration: params.site.runtimeType,
    status,
    resultKey: status === 'ready'
      ? 'environmentVerificationResultPassed'
      : status === 'failed'
        ? 'environmentVerificationResultFailed'
        : status === 'configured'
          ? 'environmentVerificationResultConfiguredOnly'
          : 'environmentVerificationResultNoEvidence',
    resultDetail: params.detail,
    checkedAt: params.checkedAt ?? null,
    source: explicit || params.configured ? params.source : 'none',
    deploymentRunId: explicit ? params.latest?.run.id ?? null : null,
  };
}

function newer(left?: string | null, right?: string | null) {
  if (!left) return false;
  if (!right) return true;
  return new Date(left).getTime() >= new Date(right).getTime();
}
