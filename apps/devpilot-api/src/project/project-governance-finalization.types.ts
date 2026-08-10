import type { Prisma } from "@prisma/client";

export interface ProjectGovernanceFinalizationInput {
  teamId: string;
  projectId: string;
  actorId: string;
  expectedStatus: string;
  expectedRevision: number;
  allowAlreadyReady?: boolean;
  auditAction: string;
  auditSummary: string;
  auditMetadata?: Prisma.InputJsonObject;
}

export interface GovernedBaselineEnvironment {
  id: string;
  key: "staging" | "production";
  baselineRole: "staging" | "production";
  configRevisionId: string;
}

export interface ProjectGovernanceFinalizationResult {
  projectId: string;
  onboardingRevision: number;
  finalizedAt: string;
  environments: GovernedBaselineEnvironment[];
}
