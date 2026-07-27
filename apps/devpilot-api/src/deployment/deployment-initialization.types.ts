export type DeploymentInitializationDecisionStatus =
  | "not_configured"
  | "planned"
  | "reserved"
  | "retry_after_failure"
  | "skipped_already_completed"
  | "blocked_missing_scope"
  | "blocked_in_progress";

export type DeploymentInitializationDecision = {
  status: DeploymentInitializationDecisionStatus;
  commandFingerprint?: string;
  checkpointId?: string;
  ownerDeploymentRunId?: string;
  skipReason?: string;
};

export function plannedInitializationDecision(
  command?: string,
): DeploymentInitializationDecision {
  return command?.trim() ? { status: "planned" } : { status: "not_configured" };
}
