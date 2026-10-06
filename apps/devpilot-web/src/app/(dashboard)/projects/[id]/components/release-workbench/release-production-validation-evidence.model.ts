import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../../types/release-order-evidence.types';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';

export type ProductionCurrentVersion = ProjectDeliverySummary['currentVersions']['production'];
export type ProductionValidationEvidence = {
  status: string;
  checkedAt: string | null;
  source: string;
};

export function artifactIntegrityEvidence(
  run: ReleaseEvidenceProductionRun | null,
  deployment: ReleaseEvidenceDeploymentRun | null,
): ProductionValidationEvidence {
  if (!run || !deployment || !deployment.manifest) {
    return unavailable('ReleaseRun + DeploymentRun Manifest');
  }
  const matches =
    deployment.artifactManifestId === run.artifactManifestId &&
    deployment.manifest.id === run.artifactManifestId &&
    deployment.manifest.digest === run.manifest.digest &&
    run.verifiedDigest === run.manifest.digest;
  return evidence(
    matches ? 'passed' : 'failed',
    null,
    'ReleaseRun.verifiedDigest + DeploymentRun.manifest',
  );
}

export function environmentVersionEvidence(
  run: ReleaseEvidenceProductionRun | null,
  deployment: ReleaseEvidenceDeploymentRun | null,
  current: ProductionCurrentVersion,
): ProductionValidationEvidence {
  if (!run || !deployment || !current) {
    return unavailable('ProjectDeliverySummary.currentVersions.production');
  }
  const matches =
    current.releaseOrderId === run.releaseOrderId &&
    current.artifactManifestId === run.artifactManifestId &&
    current.manifestDigest === run.manifest.digest &&
    current.manifestDigest === run.verifiedDigest &&
    current.deploymentRunId === deployment.id;
  return evidence(
    matches ? 'passed' : 'failed',
    current.effectiveAt,
    'ProjectDeliverySummary.currentVersions.production',
  );
}

export function structuredBlockEvidence(
  deployment: ReleaseEvidenceDeploymentRun | null,
  key: 'workloadReady' | 'healthProbe',
): ProductionValidationEvidence {
  const block = record(record(deployment?.result)[key]);
  if (Object.keys(block).length === 0) return unavailable(`DeploymentRun.result.${key}`);
  return evidence(
    string(block.status) || 'unavailable',
    string(block.checkedAt),
    `DeploymentRun.result.${key}`,
  );
}

export function entryProbeEvidence(
  deployment: ReleaseEvidenceDeploymentRun | null,
): ProductionValidationEvidence {
  const probe = deployment?.siteProbe;
  if (!probe) return unavailable('DeploymentRun.siteProbe.dns/tls/http');
  const statuses = {
    dns: normalizedStatus(probe.dns.status),
    tls: normalizedStatus(probe.tls.status),
    http: normalizedStatus(probe.http.status),
  };
  const values = Object.values(statuses);
  let status = 'unavailable';
  if (values.some((item) => ['failed', 'blocked', 'invalid', 'error'].includes(item))) {
    status = 'failed';
  } else if (values.some((item) => ['running', 'created', 'queued', 'pending'].includes(item))) {
    status = 'running';
  } else if (
    ['resolved', 'passed', 'succeeded', 'verified'].includes(statuses.dns) &&
    ['valid', 'not_required', 'passed', 'succeeded', 'verified'].includes(statuses.tls) &&
    ['passed', 'succeeded', 'verified'].includes(statuses.http)
  ) {
    status = 'passed';
  }
  return evidence(
    status,
    probe.probedAt || latestIso([probe.dns.checkedAt, probe.tls.checkedAt, probe.http.checkedAt]),
    'DeploymentRun.siteProbe.dns/tls/http',
  );
}

function normalizedStatus(value: unknown) {
  return String(value || '').toLowerCase();
}

export function routeSwitchEvidence(
  run: ReleaseEvidenceProductionRun | null,
  deployment: ReleaseEvidenceDeploymentRun | null,
): ProductionValidationEvidence {
  const route = deployment?.routeSwitch;
  if (!run || !deployment || !route) return unavailable('DeploymentRun.routeSwitch');
  const mismatched =
    (route.deploymentRunId !== null && route.deploymentRunId !== deployment.id) ||
    (route.releaseRunId !== null && route.releaseRunId !== run.id);
  return evidence(
    mismatched ? 'failed' : route.status || 'unavailable',
    route.switchedAt,
    'DeploymentRun.routeSwitch',
  );
}

function evidence(status: string, checkedAt: string | null, source: string) {
  return { status, checkedAt, source };
}

function unavailable(source: string) {
  return evidence('unavailable', null, source);
}

function latestIso(values: Array<string | null>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
