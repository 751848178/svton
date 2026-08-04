import type { GovernedBaselineEnvironment } from "../project/project-governance-finalization.types";

export type ProjectIntakeStatus =
  | "draft"
  | "analyzing"
  | "review"
  | "ready"
  | "needs_configuration";

export interface FinalizeProjectIntakeInput {
  teamId: string;
  projectId: string;
  analysisRunId: string;
  actorId: string;
  idempotencyKey: string;
  inputHash: string;
  finalizationId: string;
}

export type FinalizedBaselineEnvironment = GovernedBaselineEnvironment;

export interface ProjectIntakeFinalizationResult {
  projectId: string;
  repositoryIdentityId: string;
  onboardingRevision: number;
  finalizedAt: string;
  environments: FinalizedBaselineEnvironment[];
}
