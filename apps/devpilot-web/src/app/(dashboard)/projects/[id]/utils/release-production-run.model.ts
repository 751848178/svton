import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import type { ProductionReleasePreview } from '../types/release-production.types';

const ACTIVE_RUN_STATUSES = new Set([
  'created',
  'pending',
  'queued',
  'awaiting_approval',
  'running',
  'awaiting_validation',
]);

export type ProductionConfirmBlocker = 'preflight' | 'concurrency' | null;

export function productionConfirmBlocker(
  preview: ProductionReleasePreview | null,
): ProductionConfirmBlocker {
  if (!preview) return null;
  if (preview.preflight.decision.preApprovalAllowed !== true) return 'preflight';
  if (preview.preflight.concurrency?.state === 'occupied') return 'concurrency';
  return null;
}

export function productionRunNeedsPolling(run: ReleaseEvidenceProductionRun | null) {
  if (!run) return false;
  if (ACTIVE_RUN_STATUSES.has(run.status.toLowerCase())) return true;
  return run.deploymentRuns.some((item) => ACTIVE_RUN_STATUSES.has(item.status.toLowerCase()));
}
