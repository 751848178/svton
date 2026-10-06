import type { EnvironmentSettingsTab } from "./project-delivery-environment-readiness.policy";
import type { ProjectDeliverySummaryRecord } from "./project-delivery-summary.select";
import type {
  ProjectDeliveryAction,
  ProjectDeliveryBaselineRole,
  ProjectDeliveryCheckpoint,
} from "./project-delivery-summary.types";

export type ProjectDeliveryBaseline = {
  role: ProjectDeliveryBaselineRole;
  environment: ProjectDeliverySummaryRecord["environments"][number] | undefined;
};

export function projectDeliveryAction(
  projectId: string,
  kind: string,
  suffix: string,
) {
  return { kind, href: `/projects/${projectId}${suffix}` };
}

export function projectDeliveryEnvironmentAction(
  projectId: string,
  environment: NonNullable<ProjectDeliveryBaseline["environment"]>,
  kind: string,
  tab: EnvironmentSettingsTab,
) {
  return projectDeliveryAction(
    projectId,
    kind,
    `/settings?section=environments&env=${encodeURIComponent(environment.key)}&envTab=${tab}`,
  );
}

export function projectDeliveryCheckpoint(
  id: ProjectDeliveryCheckpoint["id"],
  scope: ProjectDeliveryCheckpoint["scope"],
  ready: boolean,
  reasonCode: string,
  next: ProjectDeliveryAction | null,
  evidenceRefs: string[] = [],
): ProjectDeliveryCheckpoint {
  return {
    id,
    scope,
    status: ready ? "ready" : "action_required",
    reasonCodes: ready ? [] : [reasonCode],
    evidenceRefs,
    action: ready ? null : next,
  };
}

export function projectDeliveryPolicyCheckpoint(
  id: ProjectDeliveryCheckpoint["id"],
  scope: ProjectDeliveryBaselineRole,
  readiness: {
    ready: boolean;
    blocked?: boolean;
    reasonCode: string;
    evidenceRefs: string[];
  },
  next: ProjectDeliveryAction,
) {
  const value = projectDeliveryCheckpoint(
    id,
    scope,
    readiness.ready,
    readiness.reasonCode,
    next,
    readiness.evidenceRefs,
  );
  return {
    ...value,
    status: readiness.ready
      ? ("ready" as const)
      : readiness.blocked
        ? ("blocked" as const)
        : ("action_required" as const),
  };
}
