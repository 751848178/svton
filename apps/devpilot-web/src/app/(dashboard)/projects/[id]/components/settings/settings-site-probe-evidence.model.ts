import type { ProjectEnvironment, ProjectSite } from '../../types';
import type { DeploymentRun } from '../../types/operations';
import { parseRunProbeEvidence } from './settings-route-probe-evidence.model';

export type SettingsSiteProbeEvidence = {
  run: DeploymentRun;
  evidence: NonNullable<ReturnType<typeof parseRunProbeEvidence>>;
};

export function latestSiteProbeEvidence(
  runs: DeploymentRun[],
  environment: ProjectEnvironment,
  site: ProjectSite,
): SettingsSiteProbeEvidence | null {
  return runs
    .filter((run) => runBelongsToEnvironment(run, environment))
    .map((run) => ({ run, evidence: parseRunProbeEvidence(run) }))
    .filter((item): item is SettingsSiteProbeEvidence =>
      Boolean(item.evidence && evidenceMatchesSite(item.evidence.siteProbe, site)),
    )
    .sort((a, b) => evidenceTime(b) - evidenceTime(a))[0] ?? null;
}

function runBelongsToEnvironment(run: DeploymentRun, environment: ProjectEnvironment) {
  if (run.projectEnvironment?.id) return run.projectEnvironment.id === environment.id;
  if (run.environment) return [environment.id, environment.key, environment.name].includes(run.environment);
  return true;
}

function evidenceMatchesSite(
  probe: NonNullable<ReturnType<typeof parseRunProbeEvidence>>['siteProbe'],
  site: ProjectSite,
) {
  if (!probe) return false;
  const domains = new Set(
    [site.primaryDomain, ...(site.aliases ?? [])].map((value) => value.toLowerCase()),
  );
  const candidates = [
    probe.primaryDomain,
    probe.dns.hostname,
    probe.tls.servername,
    probe.tls.host,
    host(probe.finalUrl),
    host(probe.http.url),
    host(probe.http.finalUrl),
  ];
  return candidates.some((value) => value && domains.has(value.toLowerCase()));
}

function evidenceTime(item: SettingsSiteProbeEvidence) {
  const value = item.evidence.siteProbe?.http.checkedAt
    ?? item.evidence.siteProbe?.probedAt
    ?? item.run.finishedAt
    ?? item.run.startedAt;
  return value ? new Date(value).getTime() || 0 : 0;
}

function host(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
