import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';

export type ReleaseInputFacts = {
  releaseVersion: string;
  sourceBranch: string | null;
  targetEnvironment: string | null;
};

export function buildReleaseInputFacts(input: {
  detail: ReleaseOrderDetail;
  projectSummary?: ProjectDeliverySummary;
}): ReleaseInputFacts {
  return {
    releaseVersion: input.detail.releaseVersion,
    sourceBranch: input.detail.preflight.repository.branch,
    targetEnvironment: input.projectSummary?.baselines.staging?.name ?? null,
  };
}
