export type ReleaseBuildSourceEvidence = {
  status: "passed" | "blocked" | "unavailable";
  reasonCode: string;
  checkedAt: string | null;
  evidenceRef: string | null;
  evidenceHash: string | null;
  exactCommit?: string;
  defaultHead?: string;
  baselineCommit?: string;
  mergeBase?: string;
  ahead?: number;
  behind?: number;
  mergeTreeClean?: boolean;
  changedPaths?: string[];
  highRiskPaths?: string[];
  commitAuthorUserId?: string;
  sourcePolicyRevision?: {
    id: string;
    profileId: string;
    profileVersion: number;
    externalRequiredChecks: number;
    requiredIndependentApprovals: number;
    snapshotHash: string;
  };
};
