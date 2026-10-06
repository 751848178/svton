import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../../types/release-order-evidence.types';
import { latestProductionRun } from './release-round.model';
import { validationTone, type ReleaseValidationCheck } from './release-staging-validation.model';
import {
  artifactIntegrityEvidence,
  entryProbeEvidence,
  environmentVersionEvidence,
  routeSwitchEvidence,
  structuredBlockEvidence,
  type ProductionCurrentVersion,
  type ProductionValidationEvidence,
} from './release-production-validation-evidence.model';

export type ProductionValidationCheck = {
  key:
    | 'artifactIntegrity'
    | 'environmentVersion'
    | 'workloadReady'
    | 'healthProbe'
    | 'entryProbe'
    | 'routeSwitch';
  status: string;
  label: ReleaseValidationCheck['label'];
  tone: ReleaseValidationCheck['tone'];
  checkedAt: string | null;
  source: string;
};

export function latestProductionDeployment(
  run: ReleaseEvidenceProductionRun | null,
): ReleaseEvidenceDeploymentRun | null {
  return (
    [...(run?.deploymentRuns ?? [])]
      .filter((deployment) => exactDeployment(run, deployment))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null
  );
}

export function releaseProductionValidationChecks(
  runs: ReleaseEvidenceProductionRun[],
  currentVersion: ProductionCurrentVersion = null,
): ProductionValidationCheck[] {
  return productionValidationChecksForRun(latestProductionRun(runs), currentVersion);
}

export function productionValidationChecksForRun(
  run: ReleaseEvidenceProductionRun | null,
  currentVersion: ProductionCurrentVersion = null,
): ProductionValidationCheck[] {
  const deployment = latestProductionDeployment(run);
  return [
    check('artifactIntegrity', artifactIntegrityEvidence(run, deployment)),
    check('environmentVersion', environmentVersionEvidence(run, deployment, currentVersion)),
    check('workloadReady', structuredBlockEvidence(deployment, 'workloadReady')),
    check('healthProbe', structuredBlockEvidence(deployment, 'healthProbe')),
    check('entryProbe', entryProbeEvidence(deployment)),
    check('routeSwitch', routeSwitchEvidence(run, deployment)),
  ];
}

export function productionValidationConclusion(
  checks: ProductionValidationCheck[],
): 'passed' | 'failed' | 'running' | 'unavailable' {
  if (checks.every((check) => check.label === 'passed')) return 'passed';
  if (checks.some((check) => check.label === 'failed')) return 'failed';
  if (checks.some((check) => check.label === 'running' || check.label === 'pending')) {
    return 'running';
  }
  return 'unavailable';
}

function check(
  key: ProductionValidationCheck['key'],
  evidence: ProductionValidationEvidence,
): ProductionValidationCheck {
  const normalized = evidence.status.toLowerCase();
  return {
    key,
    status: normalized,
    label: validationLabel(normalized),
    tone: validationTone(normalized),
    checkedAt: evidence.checkedAt,
    source: evidence.source,
  };
}

function validationLabel(status: string): ReleaseValidationCheck['label'] {
  if (['passed', 'succeeded', 'verified', 'completed', 'active', 'switched'].includes(status)) {
    return 'passed';
  }
  if (['failed', 'blocked', 'invalid'].includes(status)) return 'failed';
  if (['running', 'created', 'queued'].includes(status)) return 'running';
  if (['pending', 'awaiting_validation'].includes(status)) return 'pending';
  if (status === 'not_configured') return 'notConfigured';
  return 'unavailable';
}

function exactDeployment(
  run: ReleaseEvidenceProductionRun | null,
  deployment: ReleaseEvidenceDeploymentRun,
) {
  return Boolean(
    run &&
    deployment.projectId === run.projectId &&
    deployment.releaseOrderId === run.releaseOrderId &&
    deployment.releaseRunId === run.id &&
    deployment.environmentId === run.environmentId &&
    deployment.artifactManifestId === run.artifactManifestId &&
    deployment.source === 'release_order' &&
    deployment.dryRun === false,
  );
}
