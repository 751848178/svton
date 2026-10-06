import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import {
  stagingTechnicalConclusion,
  type ReleaseStagingValidationEvidence,
} from '../../utils/release-staging-view.model';
import {
  latestProductionDeployment,
  productionValidationChecksForRun,
  productionValidationConclusion,
  type ProductionValidationCheck,
} from './release-production-validation.model';
import { latestProductionRun } from './release-round.model';

export type ReleaseEvidenceProgress = 'missing' | 'active' | 'failed' | 'ready' | 'passed';

export interface ReleaseLifecycleEvidence {
  staging: ReleaseEvidenceProgress;
  stagingProof: ReleaseStagingValidationEvidence | null;
  productionRun: ReleaseEvidenceProductionRun | null;
  productionDeployment: ReleaseEvidenceDeploymentRun | null;
  currentProductionVersion?: ProjectDeliverySummary['currentVersions']['production'];
  production: ReleaseEvidenceProgress;
  validation: 'passed' | 'failed' | 'running' | 'unavailable';
  validationChecks: ProductionValidationCheck[];
  completed: boolean;
}

export function buildReleaseLifecycleEvidence(input: {
  detail: ReleaseOrderDetail;
  stagingRuns: ReleaseEvidenceDeploymentRun[];
  productionRuns: ReleaseEvidenceProductionRun[];
  currentProductionVersion?: ProjectDeliverySummary['currentVersions']['production'];
}): ReleaseLifecycleEvidence {
  const productionRun = latestProductionRun(input.productionRuns);
  const stagingProof = resolveStagingProof(input.stagingRuns, productionRun);
  const staging = stagingProgress(stagingProof);
  const productionDeployment = latestProductionDeployment(productionRun);
  const production = productionProgress(productionRun, productionDeployment);
  const currentProductionVersion = input.currentProductionVersion ?? null;
  const validationChecks = productionValidationChecksForRun(
    productionRun,
    currentProductionVersion,
  );
  const validation =
    production === 'passed' ? productionValidationConclusion(validationChecks) : 'unavailable';
  const completed = Boolean(
    staging === 'passed' &&
    production === 'passed' &&
    validation === 'passed' &&
    productionRun?.status.toLowerCase() === 'succeeded' &&
    input.detail.lifecycle.status === 'succeeded',
  );
  return {
    staging,
    stagingProof,
    productionRun,
    productionDeployment,
    currentProductionVersion,
    production,
    validation,
    validationChecks,
    completed,
  };
}

function resolveStagingProof(
  stagingRuns: ReleaseEvidenceDeploymentRun[],
  productionRun: ReleaseEvidenceProductionRun | null,
): ReleaseStagingValidationEvidence | null {
  if (productionRun) {
    const proof = productionRun.stagingProof;
    if (!proof || proof.dryRun || proof.artifactManifestId !== productionRun.artifactManifestId) {
      return null;
    }
    return { id: proof.deploymentRunId, ...proof };
  }
  return (
    [...stagingRuns]
      .filter((run) => !run.dryRun && run.source === 'release_order')
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null
  );
}

function stagingProgress(proof: ReleaseStagingValidationEvidence | null): ReleaseEvidenceProgress {
  if (!proof) return 'missing';
  const status = proof.status.toLowerCase();
  const conclusion = stagingTechnicalConclusion(proof);
  if (conclusion.tone === 'success') return 'passed';
  if (conclusion.tone === 'danger') return 'failed';
  if (['created', 'queued', 'running', 'pending'].includes(status)) return 'active';
  if (['completed', 'succeeded'].includes(status)) return 'ready';
  return 'missing';
}

function productionProgress(
  run: ReleaseEvidenceProductionRun | null,
  deployment: ReleaseEvidenceDeploymentRun | null,
): ReleaseEvidenceProgress {
  if (!run) return 'missing';
  const runStatus = run.status.toLowerCase();
  const deploymentStatus = deployment?.status.toLowerCase();
  if (run.promotionBlocker || ['failed', 'blocked', 'canceled', 'cancelled'].includes(runStatus)) {
    return 'failed';
  }
  if (
    deploymentStatus &&
    ['failed', 'blocked', 'canceled', 'cancelled'].includes(deploymentStatus)
  ) {
    return 'failed';
  }
  if (deploymentStatus === 'completed') return 'passed';
  return 'active';
}
